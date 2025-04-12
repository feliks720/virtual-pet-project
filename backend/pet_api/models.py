from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import math
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

# Define constants to replace magic numbers
MAX_STAT = 1000
CRITICAL_STAT_THRESHOLD = 200
GOOD_STAT_THRESHOLD = 700
SICK_HEALTH_THRESHOLD = 300
FULL_SLEEP_THRESHOLD = 950
DEFAULT_STAT = 700  # 70% of max
EVOLUTION_EXP_TEEN = 100
EVOLUTION_EXP_ADULT = 200

class Pet(models.Model):
    name = models.CharField(max_length=100)
    pet_type = models.CharField(max_length=50)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pets')
    created_at = models.DateTimeField(auto_now_add=True)
    last_interaction = models.DateTimeField(auto_now=True)
    last_stat_update = models.DateTimeField(default=timezone.now)
    
    # Pet stats with max values of 1000
    hunger = models.IntegerField(default=DEFAULT_STAT)
    happiness = models.IntegerField(default=DEFAULT_STAT)
    hygiene = models.IntegerField(default=DEFAULT_STAT)
    sleep = models.IntegerField(default=DEFAULT_STAT)
    health = models.IntegerField(default=MAX_STAT)
    
    # Growth info
    STAGES = (
        ('baby', 'Baby'),
        ('teen', 'Teen'),
        ('adult', 'Adult'),
    )
    stage = models.CharField(max_length=20, choices=STAGES, default='baby')
    experience = models.IntegerField(default=0)
    
    # Status
    STATUS_CHOICES = (
        ('alive', 'Alive'),
        ('sleeping', 'Sleeping'),
        ('sick', 'Sick'),
        ('deceased', 'Deceased'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='alive')
    sleep_start_time = models.DateTimeField(null=True, blank=True)  # Track when sleep started
    
    def __str__(self):
        return f"{self.name} ({self.pet_type})"

    def send_update_to_owner(self, update_type, data=None):
        """Send a WebSocket update to the pet owner"""
        print(f"Attempting to send update: {update_type} for pet {self.id}, data: {data}")

        channel_layer = get_channel_layer()
        
        if not channel_layer:
            print("No channel layer available!")
            return
            
        try:
            # For authenticated users
            if self.owner and hasattr(self.owner, 'id'):
                group_name = f"pet_updates_{self.owner.id}"
                print(f"Sending to group: {group_name}")
            else:
                # For anonymous users during development
                group_name = "pet_updates_anonymous"
                print(f"Sending to anonymous group")
            
            # if update_type == 'critical_stats':
            #     print(f"CRITICAL STATS SENDING: petID={self.id}, data={data}")

            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'pet_update',
                    'pet_id': self.id,
                    'update_type': update_type,
                    'data': data or {}
                }
            )
            print(f"Successfully sent {update_type} update")
        except Exception as e:
            # Log the error but don't interrupt pet updates
            print(f"WebSocket error for pet {self.id}: {str(e)}")
        
    def update_stats(self):
        """Update pet stats based on time passed since last update"""
        now = timezone.now()
        
        # Store initial values to detect changes
        old_status = self.status
        old_stage = self.stage
        
        # First check if sleeping pet should wake up
        if self.status == 'sleeping' and self.sleep >= FULL_SLEEP_THRESHOLD:
            self.status = 'alive'
            self.sleep_start_time = None
            self.send_update_to_owner('status_change', {
                'old_status': 'sleeping',
                'new_status': 'alive',
                'message': f"{self.name} woke up feeling refreshed!"
            })
        
        # Apply a single interval of changes - assume ~5 minutes has passed
        self._apply_interval_changes()
        
        # Check for critical health status changes
        self._check_health_status(old_status)
        
        # Stop processing if pet died
        if self.status != 'deceased':
            # Check for evolution
            self._check_evolution(old_stage)
            
            # Check for critical stats
            self._check_critical_stats()
        
        # Update timestamp and save
        self.last_stat_update = now
        self.save()
        
        return self
    
    def _check_evolution(self, old_stage=None):
        """Check if the pet should evolve based on experience"""
        if old_stage is None:
            old_stage = self.stage
            
        if self.experience >= EVOLUTION_EXP_TEEN and self.stage == 'baby':
            self.stage = 'teen'
            self.experience = 0
            # Notify owner that pet evolved
            self.send_update_to_owner('evolution', {
                'old_stage': 'baby',
                'new_stage': 'teen',
                'message': f"{self.name} evolved from baby to teen!"
            })
        elif self.experience >= EVOLUTION_EXP_ADULT and self.stage == 'teen':
            self.stage = 'adult'
            self.experience = 0
            # Notify owner that pet evolved
            self.send_update_to_owner('evolution', {
                'old_stage': 'teen',
                'new_stage': 'adult',
                'message': f"{self.name} evolved from teen to adult!"
            })
    
    def _check_health_status(self, old_status):
        """Check and update health status"""
        if self.health <= 0 and old_status != 'deceased':
            self.status = 'deceased'
            self.send_update_to_owner('status_change', {
                'old_status': old_status,
                'new_status': 'deceased',
                'message': f"{self.name} has passed away."
            })
        elif self.health < SICK_HEALTH_THRESHOLD and self.status == 'alive':
            if old_status != 'sick':
                self.status = 'sick'
                self.send_update_to_owner('status_change', {
                    'old_status': old_status,
                    'new_status': 'sick',
                    'message': f"{self.name} is not feeling well."
                })
        elif self.health >= SICK_HEALTH_THRESHOLD and self.status == 'sick':
            self.status = 'alive'
            self.send_update_to_owner('status_change', {
                'old_status': 'sick',
                'new_status': 'alive',
                'message': f"{self.name} has recovered and is feeling better!"
            })

    def _check_critical_stats(self):
        """Check for critically low stats and notify owner"""
        warnings = []

        print(f"Checking critical stats for pet {self.id}: hunger={self.hunger}, happiness={self.happiness}, hygiene={self.hygiene}, sleep={self.sleep}")
        print(f"Critical threshold is {CRITICAL_STAT_THRESHOLD}")
        
        if self.hunger < CRITICAL_STAT_THRESHOLD:
            warnings.append(f"{self.name} is very hungry!")
        
        if self.happiness < CRITICAL_STAT_THRESHOLD:
            warnings.append(f"{self.name} is very unhappy!")
        
        if self.hygiene < CRITICAL_STAT_THRESHOLD:
            warnings.append(f"{self.name} needs cleaning!")
        
        if self.sleep < CRITICAL_STAT_THRESHOLD and self.status != "sleeping":
            warnings.append(f"{self.name} is very tired!")
        
        # Always send an update with the current warnings
        # If warnings list is empty, it will clear the previous warnings
        self.send_update_to_owner('critical_stats', {
            'warnings': warnings
        })
        
        if not warnings:
            print("No critical stats detected")
    
    def _apply_interval_changes(self):
        """Apply stat changes for a single 5-minute interval"""
        # Apply status-specific stat changes
        if self.status == 'alive':
            self.hunger = max(0, self.hunger - 3)
            self.happiness = max(0, self.happiness - 2)
            self.hygiene = max(0, self.hygiene - 2)
            self.sleep = max(0, self.sleep - 3)
        elif self.status == 'sleeping':
            self.hunger = max(0, self.hunger - 2)
            self.happiness = max(0, self.happiness - 1)
            self.hygiene = max(0, self.hygiene - 1)
            self.sleep = min(MAX_STAT, self.sleep + 30)
        elif self.status == 'sick':
            self.hunger = max(0, self.hunger - 4)
            self.happiness = max(0, self.happiness - 3)
            self.hygiene = max(0, self.hygiene - 3)
            self.sleep = max(0, self.sleep - 4)
        else:  # deceased
            return  # No stat changes if deceased
        
        # Apply health effects
        # Health decreases if stats are critically low
        if self.hunger < CRITICAL_STAT_THRESHOLD or self.happiness < CRITICAL_STAT_THRESHOLD or self.hygiene < CRITICAL_STAT_THRESHOLD or self.sleep < CRITICAL_STAT_THRESHOLD:
            self.health = max(0, self.health - 2)
        # Health slowly recovers if all stats are good
        elif self.hunger > GOOD_STAT_THRESHOLD and self.happiness > GOOD_STAT_THRESHOLD and self.hygiene > GOOD_STAT_THRESHOLD and self.sleep > GOOD_STAT_THRESHOLD:
            self.health = min(MAX_STAT, self.health + 1)
        # Health decreases faster if sick
        if self.status == 'sick':
            self.health = max(0, self.health - 3)
    
    def _apply_partial_interval_changes(self, factor):
        """Apply stat changes for a partial 5-minute interval"""
        if self.status == 'alive':
            self.hunger = max(0, self.hunger - int(3 * factor))
            self.happiness = max(0, self.happiness - int(2 * factor))
            self.hygiene = max(0, self.hygiene - int(2 * factor))
            self.sleep = max(0, self.sleep - int(3 * factor))
        elif self.status == 'sleeping':
            self.hunger = max(0, self.hunger - int(2 * factor))
            self.happiness = max(0, self.happiness - int(1 * factor))
            self.hygiene = max(0, self.hygiene - int(1 * factor))
            self.sleep = min(MAX_STAT, self.sleep + int(30 * factor))
        elif self.status == 'sick':
            self.hunger = max(0, self.hunger - int(4 * factor))
            self.happiness = max(0, self.happiness - int(3 * factor))
            self.hygiene = max(0, self.hygiene - int(3 * factor))
            self.sleep = max(0, self.sleep - int(4 * factor))
        
        # Apply health effects (proportional to time factor)
        if self.hunger < CRITICAL_STAT_THRESHOLD or self.happiness < CRITICAL_STAT_THRESHOLD or self.hygiene < CRITICAL_STAT_THRESHOLD or self.sleep < CRITICAL_STAT_THRESHOLD:
            self.health = max(0, self.health - int(2 * factor))
        elif self.hunger > GOOD_STAT_THRESHOLD and self.happiness > GOOD_STAT_THRESHOLD and self.hygiene > GOOD_STAT_THRESHOLD and self.sleep > GOOD_STAT_THRESHOLD:
            # Only add health if the factor is significant enough
            if factor >= 0.5:
                self.health = min(MAX_STAT, self.health + 1)
        if self.status == 'sick':
            self.health = max(0, self.health - int(3 * factor))


class Interaction(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.CASCADE, related_name='interactions')
    action = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.action} with {self.pet.name} at {self.timestamp}"
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import math

class Pet(models.Model):
    name = models.CharField(max_length=100)
    pet_type = models.CharField(max_length=50)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pets')
    created_at = models.DateTimeField(auto_now_add=True)
    last_interaction = models.DateTimeField(auto_now=True)
    last_stat_update = models.DateTimeField(default=timezone.now)
    
    # Pet stats with new max values
    hunger = models.IntegerField(default=700)  # 70% of max
    happiness = models.IntegerField(default=700)
    hygiene = models.IntegerField(default=700)
    sleep = models.IntegerField(default=700)
    health = models.IntegerField(default=1000)
    
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
    
    def update_stats(self):
        """Update pet stats based on time passed since last update"""
        now = timezone.now()
        time_diff = now - self.last_stat_update
        minutes_passed = time_diff.total_seconds() / 60  # Convert to minutes
        
        # Only update if some time has passed
        if minutes_passed < 0.5:  # Less than 30 seconds
            return
        
        # Check if pet should wake up from sleeping
        if self.status == 'sleeping' and self.sleep_start_time:
            sleep_duration = now - self.sleep_start_time
            if sleep_duration.total_seconds() >= 300:  # 5 minutes in seconds
                self.status = 'alive'
                self.sleep_start_time = None
        
        # Set rate modifiers based on status
        if self.status == 'alive':
            hunger_rate = 5
            happiness_rate = 3
            hygiene_rate = 2
            sleep_rate = 4
        elif self.status == 'sleeping':
            hunger_rate = 7  # Faster hunger drop when sleeping
            happiness_rate = 1  # Slower happiness drop when sleeping
            hygiene_rate = 1  # Slower hygiene drop when sleeping
            sleep_rate = -100  # Sleep recovers when sleeping (negative means increase)
        elif self.status == 'sick':
            hunger_rate = 6
            happiness_rate = 5
            hygiene_rate = 4
            sleep_rate = 6
        else:  # deceased
            return  # No stat changes if deceased
            
        # Calculate stat changes based on time and status
        # Divide by 12 to convert from hourly rates to 5-minute rates (60 minutes / 5 = 12)
        ticks = minutes_passed / 5  # How many 5-minute periods have passed
        
        hunger_change = math.ceil((hunger_rate / 12) * ticks)
        happiness_change = math.ceil((happiness_rate / 12) * ticks)
        hygiene_change = math.ceil((hygiene_rate / 12) * ticks)
        sleep_change = math.ceil((sleep_rate / 12) * ticks)
        
        # Update stats (ensuring they stay within 0-1000 range)
        self.hunger = max(0, min(1000, self.hunger - hunger_change))
        self.happiness = max(0, min(1000, self.happiness - happiness_change))
        self.hygiene = max(0, min(1000, self.hygiene - hygiene_change))
        self.sleep = max(0, min(1000, self.sleep - sleep_change))
        
        # Health decreases if other stats are critically low
        health_change = 0
        if self.hunger < 200:  # 20% of max
            health_change -= math.ceil((2 / 12) * ticks)
        if self.happiness < 200:
            health_change -= math.ceil((1 / 12) * ticks)
        if self.hygiene < 200:
            health_change -= math.ceil((1 / 12) * ticks)
        if self.sleep < 200:
            health_change -= math.ceil((1 / 12) * ticks)
        
        # Health slowly recovers if all stats are in good condition
        if (self.hunger > 700 and self.happiness > 700 and 
            self.hygiene > 700 and self.sleep > 700 and
            self.health < 1000 and self.status == 'alive'):
            health_change += math.ceil((1 / 12) * ticks)
            
        self.health = max(0, min(1000, self.health + health_change))
        
        # Check if pet has died or became sick
        if self.health <= 0:
            self.status = 'deceased'
        elif self.health < 300 and self.status == 'alive':
            self.status = 'sick'
        # Check if pet recovered from sickness
        elif self.health >= 300 and self.status == 'sick':
            self.status = 'alive'
            
        self.last_stat_update = now
        self.save()
        
        return self


class Interaction(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.CASCADE, related_name='interactions')
    action = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.action} with {self.pet.name} at {self.timestamp}"
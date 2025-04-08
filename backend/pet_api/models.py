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
    
    # Pet stats
    hunger = models.IntegerField(default=70)
    happiness = models.IntegerField(default=70)
    energy = models.IntegerField(default=70)
    health = models.IntegerField(default=100)
    
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
    
    def __str__(self):
        return f"{self.name} ({self.pet_type})"
    
    def update_stats(self):
        """Update pet stats based on time passed since last update"""
        now = timezone.now()
        time_diff = now - self.last_stat_update
        hours_passed = time_diff.total_seconds() / 3600
        
        # Only update if some time has passed
        if hours_passed < 0.01:  # Less than ~30 seconds
            return
            
        # Calculate stat decreases based on time
        hunger_decrease = min(self.hunger, math.ceil(5 * hours_passed))
        happiness_decrease = min(self.happiness, math.ceil(3 * hours_passed))
        energy_decrease = min(self.energy, math.ceil(2 * hours_passed))
        
        # Update stats
        self.hunger = max(0, self.hunger - hunger_decrease)
        self.happiness = max(0, self.happiness - happiness_decrease)
        
        # If pet is sleeping, increase energy instead of decreasing
        if self.status == 'sleeping':
            self.energy = min(100, self.energy + math.ceil(10 * hours_passed))
        else:
            self.energy = max(0, self.energy - energy_decrease)
        
        # Health decreases if other stats are critically low
        health_decrease = 0
        if self.hunger < 20:
            health_decrease += math.ceil(2 * hours_passed)
        if self.happiness < 20:
            health_decrease += math.ceil(1 * hours_passed)
        if self.energy < 20:
            health_decrease += math.ceil(1 * hours_passed)
            
        self.health = max(0, self.health - health_decrease)
        
        # Check if pet has died
        if self.health <= 0:
            self.status = 'deceased'
        elif self.health < 30 and self.status == 'alive':
            self.status = 'sick'
            
        self.last_stat_update = now
        self.save()
        
        return self

class Interaction(models.Model):
    pet = models.ForeignKey(Pet, on_delete=models.CASCADE, related_name='interactions')
    action = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.action} with {self.pet.name} at {self.timestamp}"
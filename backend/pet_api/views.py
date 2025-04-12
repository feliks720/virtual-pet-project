from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta

from .models import Pet, Interaction
from .serializers import PetSerializer, InteractionSerializer

# Import constants from models to ensure consistency
from .models import (
    MAX_STAT, 
    CRITICAL_STAT_THRESHOLD, 
    GOOD_STAT_THRESHOLD, 
    SICK_HEALTH_THRESHOLD, 
    FULL_SLEEP_THRESHOLD,
    EVOLUTION_EXP_TEEN,
    EVOLUTION_EXP_ADULT
)

class PetViewSet(viewsets.ModelViewSet):
    serializer_class = PetSerializer
    
    def get_queryset(self):
        return Pet.objects.filter(owner=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=['post'])
    def interact(self, request, pk=None):
        pet = self.get_object()
        
        # If pet is deceased, no interactions are possible
        if pet.status == 'deceased':
            return Response(
                {"detail": "This pet has passed away and cannot be interacted with."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get('action')
        if not action:
            return Response(
                {"detail": "Action parameter is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle different interaction types
        if action == 'FEED':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't feed your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.hunger = MAX_STAT  # Fill hunger to max
            pet.health = min(MAX_STAT, pet.health + 50) if pet.health < MAX_STAT else pet.health
            
        elif action == 'PLAY':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't play with your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if pet.sleep < CRITICAL_STAT_THRESHOLD / 2:  # 10% of max
                return Response(
                    {"detail": "Your pet is too tired to play."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.happiness = MAX_STAT  # Fill happiness to max
            pet.hygiene = max(0, pet.hygiene - 50)  # Reduce hygiene
            pet.sleep = max(0, pet.sleep - 100)  # Playing makes pet more tired
            pet.experience += 5
            
        elif action == 'CLEAN':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't clean your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.hygiene = MAX_STAT  # Fill hygiene to max
            
        elif action == 'SLEEP':
            if pet.status == 'sleeping':
                # Wake up the pet
                pet.status = 'alive'
                pet.sleep_start_time = None
                
                # Make sure to save the changes
                pet.save()
                
                # Get fresh data after save
                pet = self.get_object()
                serializer = PetSerializer(pet)
                
                # Return the updated pet data
                return Response(serializer.data)
            
            # Put pet to sleep
            pet.status = 'sleeping'
            pet.sleep_start_time = timezone.now()
            
        elif action == 'MEDICINE':
            if pet.status != 'sick':
                return Response(
                    {"detail": "Your pet is not sick."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.health = min(MAX_STAT, pet.health + 300)
            if pet.health >= SICK_HEALTH_THRESHOLD:
                pet.status = 'alive'
            
        elif action == 'HEAL':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't heal your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Increase health
            health_before = pet.health
            pet.health = min(MAX_STAT, pet.health + 200)
            
            # If pet was sick and health is now above threshold, recover
            if pet.status == 'sick' and pet.health >= SICK_HEALTH_THRESHOLD:
                pet.status = 'alive'
                
            # If health didn't change, pet is already at max health
            if health_before == pet.health:
                return Response(
                    {"detail": "Your pet is already at perfect health."},
                    status=status.HTTP_200_OK
                )
                
        elif action == 'TREAT':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't give treats to your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Give a treat - improves health and happiness
            pet.health = min(MAX_STAT, pet.health + 100)
            pet.happiness = min(MAX_STAT, pet.happiness + 150)
            pet.hunger = max(0, pet.hunger + 20)  # Small decrease in hunger
            
            # If pet was sick and health is now above threshold, recover
            if pet.status == 'sick' and pet.health >= SICK_HEALTH_THRESHOLD:
                pet.status = 'alive'
        
        else:
            return Response(
                {"detail": f"Unknown action: {action}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save the interaction
        Interaction.objects.create(pet=pet, action=action)
        
        # Update pet
        pet.last_interaction = timezone.now()
        pet.save()
        
        # Check if pet should evolve - using the model's evolution check
        pet._check_evolution()
        pet.save()
        
        # Get fresh data after all updates
        pet = self.get_object()
        serializer = PetSerializer(pet)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def simulate_time(self, request, pk=None):
        pet = self.get_object()
        
        # Get minutes to simulate
        minutes = int(request.data.get('minutes', 5))
        
        # Calculate how many complete 5-minute intervals to simulate
        intervals = minutes // 5
        # Handle any remainder minutes in the final interval
        remainder = minutes % 5
        
        # Simulate each 5-minute interval separately
        for i in range(intervals):
            # Skip processing if pet is deceased
            if pet.status == 'deceased':
                break
                
            # Use the model's internal methods instead of duplicating logic
            pet._apply_interval_changes()
            
            # Update the last interaction time (staggered to reflect real passage of time)
            pet.last_interaction = timezone.now() - timedelta(minutes=5 * (intervals - i - 1))
            pet.last_stat_update = timezone.now() - timedelta(minutes=5 * (intervals - i - 1))
            
            # Check for evolution
            pet._check_evolution()
            
            # Save changes to persist state between intervals
            pet.save()
        
        # Handle any remainder minutes (less than 5)
        if remainder > 0 and pet.status != 'deceased':
            # Use the model's method for partial intervals
            factor = remainder / 5.0
            pet._apply_partial_interval_changes(factor)
            
            # Final time updates
            pet.last_interaction = timezone.now()
            pet.last_stat_update = timezone.now()
            
            # Check for evolution
            pet._check_evolution()

            # Check for critical stats
            pet._check_critical_stats()

            pet.save()
    

        # Get fresh data after all updates
        pet = self.get_object()
        serializer = PetSerializer(pet)
        return Response(serializer.data)


class InteractionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InteractionSerializer
    
    def get_queryset(self):
        return Interaction.objects.filter(pet__owner=self.request.user)
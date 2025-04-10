from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta

from .models import Pet, Interaction
from .serializers import PetSerializer, InteractionSerializer

class PetViewSet(viewsets.ModelViewSet):
    serializer_class = PetSerializer
    
    def get_queryset(self):
        return Pet.objects.filter(owner=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=['post'])
    def interact(self, request, pk=None):
        pet = self.get_object()
        
        # Update stats based on time passed
        pet.update_stats()
        
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
            pet.hunger = 1000  # Fill hunger to max
            pet.health = min(1000, pet.health + 50) if pet.health < 1000 else pet.health
            
        elif action == 'PLAY':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't play with your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if pet.sleep < 100:  # 10% of max
                return Response(
                    {"detail": "Your pet is too tired to play."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.happiness = 1000  # Fill happiness to max
            pet.hygiene = max(0, pet.hygiene - 50)  # Reduce hygiene
            pet.sleep = max(0, pet.sleep - 100)  # Playing makes pet more tired
            pet.experience += 5
            
        elif action == 'CLEAN':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't clean your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.hygiene = 1000  # Fill hygiene to max
            
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
            pet.health = min(1000, pet.health + 300)
            if pet.health >= 300:
                pet.status = 'alive'
            
        elif action == 'HEAL':
            if pet.status == 'sleeping':
                return Response(
                    {"detail": "You can't heal your pet while it's sleeping."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Increase health
            health_before = pet.health
            pet.health = min(1000, pet.health + 200)
            
            # If pet was sick and health is now above threshold, recover
            if pet.status == 'sick' and pet.health >= 300:
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
            pet.health = min(1000, pet.health + 100)
            pet.happiness = min(1000, pet.happiness + 150)
            pet.hunger = max(0, pet.hunger + 20)  # Small decrease in hunger
            
            # If pet was sick and health is now above threshold, recover
            if pet.status == 'sick' and pet.health >= 300:
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
        
        # Check if pet should evolve
        if pet.experience >= 100 and pet.stage == 'baby':
            pet.stage = 'teen'
            pet.experience = 0
        elif pet.experience >= 200 and pet.stage == 'teen':
            pet.stage = 'adult'
            pet.experience = 0
        
        # Get fresh data after all updates
        pet = self.get_object()
        serializer = PetSerializer(pet)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def simulate_time(self, request, pk=None):
        pet = self.get_object()
        
        # Get minutes to simulate (changed from hours)
        minutes = int(request.data.get('minutes', 5))  # Default to 5 minutes
        
        # Important: We need to iterate 5 minutes at a time to properly handle status changes
        ticks = minutes // 5
        for _ in range(ticks):
            # First, check if pet should wake up if it's sleeping
            if pet.status == 'sleeping' and pet.sleep_start_time:
                now = timezone.now()
                sleep_duration = now - pet.sleep_start_time
                
                # If the pet has been asleep for more than 5 minutes, wake it up
                if sleep_duration.total_seconds() >= 300:  # 5 minutes in seconds
                    pet.status = 'alive'
                    pet.sleep_start_time = None
                    
            # Simulate 5 minutes passing
            pet.last_stat_update = pet.last_stat_update - timedelta(minutes=5)
            
            # Apply the stat updates for this period with the current status
            pet.update_stats()
        
        # Get fresh data after all updates
        pet = self.get_object()
        serializer = PetSerializer(pet)
        return Response(serializer.data)


class InteractionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InteractionSerializer
    
    def get_queryset(self):
        return Interaction.objects.filter(pet__owner=self.request.user)
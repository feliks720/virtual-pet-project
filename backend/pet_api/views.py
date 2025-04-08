from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

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
        if action == 'feed':
            if pet.hunger >= 100:
                return Response(
                    {"detail": "Your pet is not hungry."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.hunger = min(100, pet.hunger + 20)
            pet.health = min(100, pet.health + 5) if pet.health < 100 else pet.health
            
        elif action == 'play':
            if pet.energy <= 10:
                return Response(
                    {"detail": "Your pet is too tired to play."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.happiness = min(100, pet.happiness + 15)
            pet.hunger = max(0, pet.hunger - 5)
            pet.energy = max(0, pet.energy - 10)
            pet.experience += 5
            
        elif action == 'sleep':
            if pet.status == 'sleeping':
                pet.status = 'alive'
                return Response(
                    {"detail": "You woke up your pet."},
                    status=status.HTTP_200_OK
                )
            pet.status = 'sleeping'
            
        elif action == 'medicine':
            if pet.status != 'sick':
                return Response(
                    {"detail": "Your pet is not sick."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pet.health = min(100, pet.health + 30)
            if pet.health >= 30:
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
        
        return Response(PetSerializer(pet).data)

class InteractionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InteractionSerializer
    
    def get_queryset(self):
        return Interaction.objects.filter(pet__owner=self.request.user)
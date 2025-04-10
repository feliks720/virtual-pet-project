from rest_framework import serializers
from .models import Pet, Interaction
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class PetSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    
    class Meta:
        model = Pet
        fields = [
            'id', 'name', 'pet_type', 'owner', 'created_at', 'last_interaction',
            'hunger', 'happiness', 'hygiene', 'sleep', 'health', 'stage', 'experience',
            'status', 'sleep_start_time'
        ]

class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = ['id', 'pet', 'action', 'timestamp']
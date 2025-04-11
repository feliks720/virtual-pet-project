# pet_api/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/pets/$', consumers.PetConsumer.as_asgi()),
]
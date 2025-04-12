# pet_api/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

class PetConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        print(f"WebSocket connection attempt by user: {self.user}, authenticated: {self.user.is_authenticated}, id: {getattr(self.user, 'id', 'None')}")
        
        # Use user-specific group
        if self.user and self.user.is_authenticated:
            self.user_group_name = f"pet_updates_{self.user.id}"
            print(f"Joining authenticated group: {self.user_group_name}")
        else:
            # Fallback for anonymous users during development
            self.user_group_name = "pet_updates_anonymous"
            print(f"Joining anonymous group: {self.user_group_name}")
        
        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        # Print channel name but NOT groups (which doesn't exist in Redis layer)
        print(f"Channel name: {self.channel_name}")
        # Remove this line: print(f"Available groups after joining: {self.channel_layer.groups}")
        
        await self.accept()
        print("WebSocket connection accepted")
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to pet updates channel'
        }))

        # # Test direct update after a short delay
        # import asyncio
        # asyncio.create_task(self.test_after_delay())

    async def disconnect(self, close_code):
        # Leave user group
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message = text_data_json.get('message', '')
            
            # Echo the message back (for testing)
            await self.send(text_data=json.dumps({
                'type': 'echo',
                'message': f'Received: {message}'
            }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error: {str(e)}'
            }))

    # Receive message from user group
    async def pet_update(self, event):
        print(f"Consumer received pet_update event: {event}")
        try:
            # Send message to WebSocket
            message = {
                'type': 'pet_update',
                'pet_id': event.get('pet_id'),
                'update_type': event.get('update_type'),
                'data': event.get('data', {})
            }
            print(f"Sending to client: {message}")
            await self.send(text_data=json.dumps(message))
            print(f"Successfully sent message to client")
        except Exception as e:
            print(f"Error sending pet update to client: {str(e)}")

    # # Testing
    # async def test_direct_update(self):
    #     """Send a test update directly using the pet_update method"""
    #     print("Testing direct pet_update call")
    #     await self.pet_update({
    #         'type': 'pet_update',
    #         'pet_id': 2,
    #         'update_type': 'critical_stats',
    #         'data': {'warnings': ['Direct pet_update test']}
    #     })
    #     print("Direct pet_update call completed")

    # async def test_after_delay(self):
    #     """Run test after a short delay to ensure connection is established"""
    #     import asyncio
    #     await asyncio.sleep(2)
    #     await self.test_direct_update()
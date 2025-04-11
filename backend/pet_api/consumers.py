# pet_api/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

class PetConsumer(AsyncWebsocketConsumer):
    async def connect(self):

        self.user = self.scope["user"]
        print("WebSocket connection attempt")

        # For development, allow anonymous connections
        # In production, you should uncomment these lines to require authentication
        # if self.user is None or isinstance(self.user, AnonymousUser):
        #     await self.close()
        #     return
        
        # Use user-specific group
        if self.user and not isinstance(self.user, AnonymousUser):
            self.user_group_name = f"pet_updates_{self.user.id}"
        else:
            # Fallback for anonymous users during development
            self.user_group_name = "pet_updates_anonymous"
        
        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        print("WebSocket connection accepted")
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to pet updates channel'
        }))

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
        try:
            # Send message to WebSocket
            await self.send(text_data=json.dumps({
                'type': 'pet_update',
                'pet_id': event.get('pet_id'),
                'update_type': event.get('update_type'),
                'data': event.get('data', {})
            }))
        except Exception as e:
            print(f"Error sending pet update to client: {str(e)}")
            # Optionally try to send an error message
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Failed to process pet update'
                }))
            except:
                pass  # Silently fail if we can't even send the error
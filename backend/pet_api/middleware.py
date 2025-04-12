# pet_api/middleware.py
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from urllib.parse import parse_qs

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()

class TokenAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Get query string from scope
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        
        # Extract token
        token = query_params.get('token', [None])[0]
        
        if token:
            # Get user from token
            user = await get_user_from_token(token)
            scope['user'] = user
            print(f"WebSocket authenticated as user: {user.username}, ID: {user.id}")
        else:
            scope['user'] = AnonymousUser()
            print("WebSocket anonymous connection")
        
        return await self.inner(scope, receive, send)
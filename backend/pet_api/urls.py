from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PetViewSet, InteractionViewSet

from django.contrib import admin
from django.urls import path, include

router = DefaultRouter()
router.register(r'pets', PetViewSet, basename='pet')
router.register(r'interactions', InteractionViewSet, basename='interaction')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('pet_api.urls')),
    path('api-auth/', include('rest_framework.urls')),
]
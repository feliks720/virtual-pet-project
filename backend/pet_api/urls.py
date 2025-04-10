from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PetViewSet, InteractionViewSet

router = DefaultRouter()
router.register(r'pets', PetViewSet, basename='pet')
router.register(r'interactions', InteractionViewSet, basename='interaction')

urlpatterns = [
    path('', include(router.urls)),
]
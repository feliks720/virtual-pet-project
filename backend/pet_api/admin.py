from django.contrib import admin
from .models import Pet, Interaction

@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ('name', 'pet_type', 'owner', 'stage', 'status', 'health')
    list_filter = ('pet_type', 'stage', 'status')
    search_fields = ('name', 'owner__username')
    
@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ('pet', 'action', 'timestamp')
    list_filter = ('action',)
    search_fields = ('pet__name',)
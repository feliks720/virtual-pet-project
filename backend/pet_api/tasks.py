# pet_api/tasks.py
from celery import shared_task
from datetime import timedelta
from django.utils import timezone

@shared_task
def update_all_pets():
    """
    Update stats for all active pets.
    Only updates pets that haven't been updated in the last 5 minutes and aren't deceased.
    """
    # Import here to avoid circular imports
    from .models import Pet
    
    pets = Pet.objects.exclude(status='deceased')
    
    updated_count = 0
    for pet in pets:
        try:
            pet.update_stats()
            updated_count += 1
        except Exception as e:
            print(f"Error updating pet {pet.id}: {str(e)}")
    
    return f"Updated {updated_count} pets"
from django.urls import path

from .views import ProducerOverviewView, ProductViewEventView

urlpatterns = [
    path('product-views/', ProductViewEventView.as_view(), name='analytics-product-view'),
    path('producer/overview/', ProducerOverviewView.as_view(), name='analytics-producer-overview'),
]

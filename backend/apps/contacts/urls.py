from django.urls import path

from .views import ContactCreateView, ContactDeleteView, ContactDetailView, ContactListView

urlpatterns = [
    path('contact/', ContactCreateView.as_view(), name='contact-create'),
    path('contact/list/', ContactListView.as_view(), name='contact-list'),
    path('contact/details/<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
    path('contact/delete/<int:pk>/', ContactDeleteView.as_view(), name='contact-delete'),
]

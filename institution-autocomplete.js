let autocomplete = null;

// Function to initialize autocomplete
function initAutocomplete(apiKey) {
  console.log('Loading Google Maps API in iframe...');

  // Load Google Maps API
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  script.defer = true;

  script.onload = () => {
    console.log('Google Maps API loaded in iframe');

    const input = document.getElementById('autocomplete-input');
    autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['establishment'],
      fields: ['place_id', 'name', 'formatted_address', 'geometry', 'website', 'formatted_phone_number', 'types']
    });

    console.log('Autocomplete initialized in iframe');

    // Listen for place selection
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      console.log('Place selected in iframe:', place);

      if (!place.geometry) {
        window.parent.postMessage({
          type: 'institution-error',
          message: 'No details available for this place'
        }, '*');
        return;
      }

      // Send place data to parent
      window.parent.postMessage({
        type: 'institution-selected',
        place: {
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          geometry: {
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            }
          },
          website: place.website,
          formatted_phone_number: place.formatted_phone_number,
          types: place.types
        }
      }, '*');
    });

    // Notify parent that initialization is complete
    window.parent.postMessage({
      type: 'institution-autocomplete-ready'
    }, '*');
  };

  script.onerror = (error) => {
    console.error('Failed to load Google Maps API in iframe:', error);
    window.parent.postMessage({
      type: 'institution-error',
      message: 'Failed to load Google Maps API'
    }, '*');
  };

  document.head.appendChild(script);
}

// Listen for initialization message from parent
window.addEventListener('message', (event) => {
  if (event.data.type === 'init-institution-autocomplete') {
    initAutocomplete(event.data.apiKey);
  } else if (event.data.type === 'focus-input') {
    document.getElementById('autocomplete-input').focus();
  } else if (event.data.type === 'clear-input') {
    document.getElementById('autocomplete-input').value = '';
  }
});

// Forward input events to parent for validation
const input = document.getElementById('autocomplete-input');
if (input) {
  input.addEventListener('input', (e) => {
    window.parent.postMessage({
      type: 'institution-input',
      value: e.target.value
    }, '*');
  });
}

// Notify parent that iframe is ready
window.parent.postMessage({
  type: 'institution-iframe-ready'
}, '*');

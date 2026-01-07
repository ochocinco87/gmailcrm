// OpenStreetMap Nominatim Autocomplete (no API key, no CSP issues)
class PlacesAutocomplete {
  constructor(inputElement, apiKey, onSelect) {
    console.log('PlacesAutocomplete constructor called (using OpenStreetMap Nominatim)');

    if (!inputElement) {
      console.error('PlacesAutocomplete: Input element is null or undefined');
      return;
    }

    this.input = inputElement;
    this.onSelect = onSelect;
    this.resultsContainer = null;
    this.selectedIndex = -1;

    this.init();
  }


  init() {
    console.log('PlacesAutocomplete init() called');

    // Create results container
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'places-autocomplete-results';
    this.resultsContainer.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      max-height: 300px;
      overflow-y: auto;
      z-index: 10000;
      display: none;
      min-width: ${this.input.offsetWidth}px;
    `;

    // Position it below the input
    const rect = this.input.getBoundingClientRect();
    this.resultsContainer.style.top = (rect.bottom + window.scrollY) + 'px';
    this.resultsContainer.style.left = rect.left + 'px';

    document.body.appendChild(this.resultsContainer);
    console.log('PlacesAutocomplete: Results container added to body', {
      top: this.resultsContainer.style.top,
      left: this.resultsContainer.style.left,
      zIndex: this.resultsContainer.style.zIndex
    });

    // Input event listener
    let debounceTimer;
    this.input.addEventListener('input', (e) => {
      console.log('Input event fired:', e.target.value);
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (query.length < 3) {
        console.log('Query too short (<3 chars), hiding results');
        this.hideResults();
        return;
      }

      console.log('Debouncing search for:', query);
      debounceTimer = setTimeout(() => {
        this.searchPlaces(query);
      }, 300);
    });

    console.log('PlacesAutocomplete: Input listener attached');

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (!this.resultsContainer || this.resultsContainer.style.display === 'none') return;

      const items = this.resultsContainer.querySelectorAll('.place-result-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection(items);
      } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
        e.preventDefault();
        items[this.selectedIndex].click();
      } else if (e.key === 'Escape') {
        this.hideResults();
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.input.contains(e.target) && !this.resultsContainer.contains(e.target)) {
        this.hideResults();
      }
    });
  }

  updateSelection(items) {
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.style.background = '#e8f0fe';
      } else {
        item.style.background = 'white';
      }
    });
  }

  async searchPlaces(query) {
    try {
      console.log('Searching places with Nominatim:', query);

      // Use OpenStreetMap Nominatim API (free, no API key needed)
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query + ' hospital clinic medical')}` +
        `&format=json` +
        `&addressdetails=1` +
        `&limit=10` +
        `&countrycodes=us`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Gmail-CRM-Extension/4.2.1'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Nominatim API response:', data);

      if (data && data.length > 0) {
        // Filter for healthcare facilities
        const healthcarePlaces = data.filter(place => {
          const type = place.type || '';
          const name = (place.name || '').toLowerCase();
          const displayName = (place.display_name || '').toLowerCase();

          return type === 'hospital' ||
                 type === 'clinic' ||
                 type === 'doctors' ||
                 name.includes('hospital') ||
                 name.includes('clinic') ||
                 name.includes('medical') ||
                 displayName.includes('hospital') ||
                 displayName.includes('clinic') ||
                 displayName.includes('medical');
        });

        const results = healthcarePlaces.length > 0 ? healthcarePlaces : data;

        if (results.length > 0) {
          this.showResults(results);
        } else {
          this.hideResults();
        }
      } else {
        this.hideResults();
      }
    } catch (error) {
      console.error('Places search error:', error);
      this.hideResults();
    }
  }

  showResults(places) {
    console.log('showResults called with', places.length, 'places');
    this.resultsContainer.innerHTML = '';
    this.selectedIndex = -1;

    places.forEach(place => {
      const item = document.createElement('div');
      item.className = 'place-result-item';
      item.style.cssText = `
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f1f3f4;
        transition: background 0.15s ease;
      `;

      // Extract name and address from Nominatim response
      const name = place.name || place.display_name.split(',')[0];
      const address = place.display_name.replace(name + ', ', '');

      item.innerHTML = `
        <div style="font-weight: 500; color: #202124; margin-bottom: 4px;">
          ${this.escapeHtml(name)}
        </div>
        <div style="font-size: 12px; color: #5f6368;">
          ${this.escapeHtml(address)}
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f8f9fa';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = 'white';
      });

      item.addEventListener('click', () => {
        this.selectPlace(place);
      });

      this.resultsContainer.appendChild(item);
    });

    const rect = this.input.getBoundingClientRect();
    this.resultsContainer.style.top = (rect.bottom + window.scrollY) + 'px';
    this.resultsContainer.style.left = rect.left + 'px';
    this.resultsContainer.style.minWidth = this.input.offsetWidth + 'px';
    this.resultsContainer.style.display = 'block';

    console.log('Results dropdown displayed:', {
      display: this.resultsContainer.style.display,
      top: this.resultsContainer.style.top,
      left: this.resultsContainer.style.left,
      childCount: this.resultsContainer.children.length
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  selectPlace(place) {
    console.log('Selected place:', place);

    const name = place.name || place.display_name.split(',')[0];
    this.input.value = name;
    this.hideResults();

    // Call onSelect with Nominatim data formatted to match expected structure
    this.onSelect({
      place_id: place.place_id || place.osm_id,
      name: name,
      formatted_address: place.display_name,
      geometry: {
        location: {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon)
        }
      },
      website: place.address?.website || null,
      formatted_phone_number: place.address?.phone || null,
      types: [place.type || 'healthcare']
    });
  }

  hideResults() {
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'none';
      this.selectedIndex = -1;
    }
  }

  destroy() {
    if (this.resultsContainer) {
      this.resultsContainer.remove();
    }
  }
}

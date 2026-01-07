// Google Places API Autocomplete using REST API (no CSP issues)
class PlacesAutocomplete {
  constructor(inputElement, apiKey, onSelect) {
    this.input = inputElement;
    this.apiKey = apiKey;
    this.onSelect = onSelect;
    this.resultsContainer = null;
    this.sessionToken = this.generateSessionToken();
    this.selectedIndex = -1;

    this.init();
  }

  generateSessionToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  init() {
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

    // Input event listener
    let debounceTimer;
    this.input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (query.length < 3) {
        this.hideResults();
        return;
      }

      debounceTimer = setTimeout(() => {
        this.searchPlaces(query);
      }, 300);
    });

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
      console.log('Searching places:', query);

      // Use Places API Autocomplete endpoint
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment&key=${this.apiKey}&sessiontoken=${this.sessionToken}`;

      // Use a proxy or CORS-enabled endpoint
      // Since we're in a content script, we need to use chrome.runtime to make the request
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'places-autocomplete',
          query: query,
          apiKey: this.apiKey,
          sessionToken: this.sessionToken
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      console.log('Places API response:', response);

      if (response.predictions && response.predictions.length > 0) {
        this.showResults(response.predictions);
      } else {
        this.hideResults();
      }
    } catch (error) {
      console.error('Places search error:', error);
    }
  }

  showResults(predictions) {
    this.resultsContainer.innerHTML = '';
    this.selectedIndex = -1;

    predictions.forEach(prediction => {
      const item = document.createElement('div');
      item.className = 'place-result-item';
      item.style.cssText = `
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f1f3f4;
        transition: background 0.15s ease;
      `;

      item.innerHTML = `
        <div style="font-weight: 500; color: #202124; margin-bottom: 4px;">
          ${this.highlightMatch(prediction.structured_formatting.main_text, prediction.structured_formatting.main_text_matched_substrings)}
        </div>
        <div style="font-size: 12px; color: #5f6368;">
          ${prediction.structured_formatting.secondary_text || ''}
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f8f9fa';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = 'white';
      });

      item.addEventListener('click', () => {
        this.selectPlace(prediction.place_id, prediction.description);
      });

      this.resultsContainer.appendChild(item);
    });

    const rect = this.input.getBoundingClientRect();
    this.resultsContainer.style.top = (rect.bottom + window.scrollY) + 'px';
    this.resultsContainer.style.left = rect.left + 'px';
    this.resultsContainer.style.minWidth = this.input.offsetWidth + 'px';
    this.resultsContainer.style.display = 'block';
  }

  highlightMatch(text, matches) {
    if (!matches || matches.length === 0) return text;

    let result = '';
    let lastIndex = 0;

    matches.forEach(match => {
      result += text.substring(lastIndex, match.offset);
      result += `<strong>${text.substring(match.offset, match.offset + match.length)}</strong>`;
      lastIndex = match.offset + match.length;
    });

    result += text.substring(lastIndex);
    return result;
  }

  async selectPlace(placeId, description) {
    console.log('Selected place:', placeId, description);
    this.input.value = description;
    this.hideResults();

    try {
      // Get place details
      const details = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'place-details',
          placeId: placeId,
          apiKey: this.apiKey,
          sessionToken: this.sessionToken
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      console.log('Place details:', details);

      if (details.result) {
        const place = details.result;
        this.onSelect({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          geometry: {
            location: place.geometry.location
          },
          website: place.website,
          formatted_phone_number: place.formatted_phone_number,
          types: place.types
        });
      }

      // Generate new session token for next search
      this.sessionToken = this.generateSessionToken();
    } catch (error) {
      console.error('Place details error:', error);
    }
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

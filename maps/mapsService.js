const axios = require('axios');

/**
 * Google Maps Service
 * 
 * Provides direct access to Google Maps APIs:
 * - Places API (text search, nearby search, place details)
 * - Distance Matrix API (distance/time between locations)
 * - Geocoding API (address ⟷ coordinates)
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY not found in environment variables');
}

/**
 * Search for places using Google Places API (text search)
 * @param {Object} params
 * @param {string} params.query - Search query (e.g., "cafes near me", "hotels in Goa")
 * @param {string} [params.location] - Optional "lat,lng" to bias results
 * @param {number} [params.radius] - Optional radius in meters
 * @returns {Promise<Object>} Search results
 */
async function placesSearch({ query, location, radius }) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
  const params = {
    query,
    key: GOOGLE_MAPS_API_KEY
  };

  if (location) {
    params.location = location;
  }
  if (radius) {
    params.radius = radius;
  }

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    return {
      status: response.data.status,
      results: response.data.results.map(place => ({
        place_id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        location: place.geometry.location,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        types: place.types,
        business_status: place.business_status,
        opening_hours: place.opening_hours,
        photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height
        })) : []
      })),
      next_page_token: response.data.next_page_token
    };
  } catch (error) {
    console.error('[MapsService] placesSearch error:', error.response?.data || error.message);
    throw new Error(`Failed to search places: ${error.message}`);
  }
}

/**
 * Find nearby places around a location (more structured than text search)
 * @param {Object} params
 * @param {string} params.location - Required "lat,lng"
 * @param {number} params.radius - Search radius in meters (max 50000)
 * @param {string} [params.type] - Optional type filter (e.g., restaurant, hospital, cafe)
 * @returns {Promise<Object>} Nearby places
 */
async function nearbySearch({ location, radius, type }) {
  if (!location || typeof location !== 'string') {
    throw new Error('Location is required and must be a string in "lat,lng" format');
  }
  if (!radius || typeof radius !== 'number') {
    throw new Error('Radius is required and must be a number');
  }

  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = {
    location,
    radius,
    key: GOOGLE_MAPS_API_KEY
  };

  if (type) {
    params.type = type;
  }

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    return {
      status: response.data.status,
      results: response.data.results.map(place => ({
        place_id: place.place_id,
        name: place.name,
        vicinity: place.vicinity,
        location: place.geometry.location,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        types: place.types,
        business_status: place.business_status,
        opening_hours: place.opening_hours,
        price_level: place.price_level,
        photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height
        })) : []
      })),
      next_page_token: response.data.next_page_token
    };
  } catch (error) {
    console.error('[MapsService] nearbySearch error:', error.response?.data || error.message);
    throw new Error(`Failed to search nearby places: ${error.message}`);
  }
}

/**
 * Get detailed information about a place
 * @param {Object} params
 * @param {string} params.place_id - The Google Place ID
 * @returns {Promise<Object>} Place details
 */
async function placeDetails({ place_id }) {
  if (!place_id || typeof place_id !== 'string') {
    throw new Error('place_id is required and must be a string');
  }

  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  const params = {
    place_id,
    key: GOOGLE_MAPS_API_KEY,
    fields: 'name,formatted_address,formatted_phone_number,international_phone_number,opening_hours,website,rating,user_ratings_total,reviews,photos,geometry,price_level,types,url,business_status'
  };

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    const place = response.data.result;
    return {
      place_id: place_id,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number || place.international_phone_number,
      website: place.website,
      location: place.geometry?.location,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      types: place.types,
      business_status: place.business_status,
      url: place.url,
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now,
        weekday_text: place.opening_hours.weekday_text,
        periods: place.opening_hours.periods
      } : null,
      reviews: place.reviews ? place.reviews.slice(0, 5).map(review => ({
        author_name: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        relative_time_description: review.relative_time_description
      })) : [],
      photos: place.photos ? place.photos.slice(0, 5).map(photo => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height
      })) : []
    };
  } catch (error) {
    console.error('[MapsService] placeDetails error:', error.response?.data || error.message);
    throw new Error(`Failed to get place details: ${error.message}`);
  }
}

/**
 * Compute distance and travel time between locations
 * @param {Object} params
 * @param {string} params.origins - "lat,lng" OR full address
 * @param {string} params.destinations - "lat,lng" OR full address
 * @param {string} [params.mode] - driving (default) | walking | bicycling | transit
 * @returns {Promise<Object>} Distance and duration information
 */
async function distanceMatrix({ origins, destinations, mode = 'driving' }) {
  if (!origins || typeof origins !== 'string') {
    throw new Error('origins is required and must be a string');
  }
  if (!destinations || typeof destinations !== 'string') {
    throw new Error('destinations is required and must be a string');
  }

  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  const params = {
    origins,
    destinations,
    mode,
    key: GOOGLE_MAPS_API_KEY
  };

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Distance Matrix API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    const element = response.data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      throw new Error(`No route found between locations`);
    }

    return {
      origin: response.data.origin_addresses[0],
      destination: response.data.destination_addresses[0],
      distance: {
        text: element.distance.text,
        value: element.distance.value // meters
      },
      duration: {
        text: element.duration.text,
        value: element.duration.value // seconds
      },
      mode: mode
    };
  } catch (error) {
    console.error('[MapsService] distanceMatrix error:', error.response?.data || error.message);
    throw new Error(`Failed to calculate distance: ${error.message}`);
  }
}

/**
 * Convert an address to latitude/longitude coordinates
 * @param {Object} params
 * @param {string} params.address - Human-readable address
 * @returns {Promise<Object>} Geocoding results
 */
async function geocode({ address }) {
  if (!address || typeof address !== 'string') {
    throw new Error('address is required and must be a string');
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const params = {
    address,
    key: GOOGLE_MAPS_API_KEY
  };

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Geocoding API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    if (response.data.status === 'ZERO_RESULTS') {
      return {
        status: 'ZERO_RESULTS',
        results: []
      };
    }

    return {
      status: response.data.status,
      results: response.data.results.map(result => ({
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        location_type: result.geometry.location_type,
        place_id: result.place_id,
        types: result.types,
        address_components: result.address_components
      }))
    };
  } catch (error) {
    console.error('[MapsService] geocode error:', error.response?.data || error.message);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

/**
 * Convert coordinates to a human-readable address
 * @param {Object} params
 * @param {number} params.lat - Latitude
 * @param {number} params.lng - Longitude
 * @returns {Promise<Object>} Reverse geocoding results
 */
async function reverseGeocode({ lat, lng }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('lat and lng are required and must be numbers');
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const params = {
    latlng: `${lat},${lng}`,
    key: GOOGLE_MAPS_API_KEY
  };

  try {
    const response = await axios.get(url, { params });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Reverse Geocoding API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    if (response.data.status === 'ZERO_RESULTS') {
      return {
        status: 'ZERO_RESULTS',
        results: []
      };
    }

    return {
      status: response.data.status,
      results: response.data.results.map(result => ({
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        location_type: result.geometry.location_type,
        place_id: result.place_id,
        types: result.types,
        address_components: result.address_components
      }))
    };
  } catch (error) {
    console.error('[MapsService] reverseGeocode error:', error.response?.data || error.message);
    throw new Error(`Failed to reverse geocode: ${error.message}`);
  }
}

module.exports = {
  placesSearch,
  nearbySearch,
  placeDetails,
  distanceMatrix,
  geocode,
  reverseGeocode
};

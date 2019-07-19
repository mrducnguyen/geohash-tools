// Default geohash length
export const GEOHASH_PRECISION = 10;

// Characters used in location geohashes
export const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const NEIGHBOUR = {
  n: [ 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx' ],
  s: [ '14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp' ],
  e: [ 'bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy' ],
  w: [ '238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb' ],
};
export const BORDER = {
  n: [ 'prxz',     'bcfguvyz' ],
  s: [ '028b',     '0145hjnp' ],
  e: [ 'bcfguvyz', 'prxz'     ],
  w: [ '0145hjnp', '028b'     ],
};

// The meridional circumference of the earth in meters
export const EARTH_MERI_CIRCUMFERENCE = 40007860;

// Length of a degree latitude at the equator
export const METERS_PER_DEGREE_LATITUDE = 110574;

// Number of bits per geohash character
export const BITS_PER_CHAR = 5;

// Maximum length of a geohash in bits
export const MAXIMUM_BITS_PRECISION = 22 * BITS_PER_CHAR;

// Equatorial radius of the earth in meters
export const EARTH_EQ_RADIUS = 6378137.0;

// The following value assumes a polar radius of
// const EARTH_POL_RADIUS = 6356752.3;
// The formulate to calculate E2 is
// E2 == (EARTH_EQ_RADIUS^2-EARTH_POL_RADIUS^2)/(EARTH_EQ_RADIUS^2)
// The exact value is used here to avoid rounding errors
export const E2 = 0.00669447819799;

// Cutoff for rounding errors on double calculations
export const EPSILON = 1e-12;

function log2(x: number): number {
  return Math.log(x) / Math.log(2);
}

/**
 * Validates the inputted key and throws an error if it is invalid.
 *
 * @param key The key to be verified.
 */
export function validateKey(key: string): void {
  let error: string;

  if (typeof key !== 'string') {
    error = 'key must be a string';
  } else if (key.length === 0) {
    error = 'key cannot be the empty string';
  } else if (1 + GEOHASH_PRECISION + key.length > 755) {
    // Firebase can only stored child paths up to 768 characters
    // The child path for this key is at the least: 'i/<geohash>key'
    error = 'key is too long to be stored in Firebase';
  } else if (/[\[\].#$\/\u0000-\u001F\u007F]/.test(key)) {
    // Firebase does not allow node keys to contain the following characters
    error = 'key cannot contain any of the following characters: . # $ ] [ /';
  }

  if (typeof error !== 'undefined') {
    throw new Error('Invalid GeoFire key \'' + key + '\': ' + error);
  }
}

/**
 * Validates the inputted location and throws an error if it is invalid.
 *
 * @param location The [latitude, longitude] pair to be verified.
 */
export function validateLocation(location: number[]): void {
  let error: string;

  if (!Array.isArray(location)) {
    error = 'location must be an array';
  } else if (location.length !== 2) {
    error = 'expected array of length 2, got length ' + location.length;
  } else {
    const latitude = location[0];
    const longitude = location[1];

    if (typeof latitude !== 'number' || isNaN(latitude)) {
      error = 'latitude must be a number';
    } else if (latitude < -90 || latitude > 90) {
      error = 'latitude must be within the range [-90, 90]';
    } else if (typeof longitude !== 'number' || isNaN(longitude)) {
      error = 'longitude must be a number';
    } else if (longitude < -180 || longitude > 180) {
      error = 'longitude must be within the range [-180, 180]';
    }
  }

  if (typeof error !== 'undefined') {
    throw new Error('Invalid GeoFire location \'' + location + '\': ' + error);
  }
}

/**
 * Validates the inputted geohash and throws an error if it is invalid.
 *
 * @param geohash The geohash to be validated.
 */
export function validateGeohash(geohash: string): void {
  let error;

  if (typeof geohash !== 'string') {
    error = 'geohash must be a string';
  } else if (geohash.length === 0) {
    error = 'geohash cannot be the empty string';
  } else {
    for (const letter of geohash) {
      if (BASE32.indexOf(letter) === -1) {
        error = 'geohash cannot contain \'' + letter + '\'';
      }
    }
  }

  if (typeof error !== 'undefined') {
    throw new Error('Invalid GeoFire geohash \'' + geohash + '\': ' + error);
  }
}

/**
 * Converts degrees to radians.
 *
 * @param degrees The number of degrees to be converted to radians.
 * @returns The number of radians equal to the inputted number of degrees.
 */
export function degreesToRadians(degrees: number): number {
  if (typeof degrees !== 'number' || isNaN(degrees)) {
    throw new Error('Error: degrees must be a number');
  }

  return (degrees * Math.PI / 180);
}

/**
 * Generates a geohash of the specified precision/string length from the  [latitude, longitude]
 * pair, specified as an array.
 *
 * @param lat The latitude.
 * @param lng The longitude.
 * @param precision The length of the geohash to create. If no precision is specified, the
 * global default is used.
 * @returns The geohash of the inputted location.
 */
export function encode(lat:number, lng:number, precision:number = GEOHASH_PRECISION): string {
  validateLocation([lat, lng]);
  if (typeof precision !== 'undefined') {
    if (typeof precision !== 'number' || isNaN(precision)) {
      throw new Error('precision must be a number');
    } else if (precision <= 0) {
      throw new Error('precision must be greater than 0');
    } else if (precision > 22) {
      throw new Error('precision cannot be greater than 22');
    } else if (Math.round(precision) !== precision) {
      throw new Error('precision must be an integer');
    }
  }

  const latitudeRange = {
    min: -90,
    max: 90
  };
  const longitudeRange = {
    min: -180,
    max: 180
  };
  let hash = '';
  let hashVal = 0;
  let bits = 0;
  let even: number | boolean = 1;

  while (hash.length < precision) {
    const val = even ? lng : lat;
    const range = even ? longitudeRange : latitudeRange;
    const mid = (range.min + range.max) / 2;

    if (val > mid) {
      hashVal = (hashVal << 1) + 1;
      range.min = mid;
    } else {
      hashVal = (hashVal << 1) + 0;
      range.max = mid;
    }

    even = !even;
    if (bits < 4) {
      bits++;
    } else {
      bits = 0;
      hash += BASE32[hashVal];
      hashVal = 0;
    }
  }

  return hash;
}

/**
 * Decode geohash to latitude/longitude (location is approximate centre of geohash cell,
 *     to reasonable precision).
 *
 * @param   {string} geohash - Geohash string to be converted to latitude/longitude.
 * @returns {{lat:number, lng:number}} (Center of) geohashed location.
 * @throws  Invalid geohash.
 *
 * @example
 *     const latlng = Geohash.decode('u120fxw'); // => { lat: 52.205, lng: 0.1188 }
 */
export function decode(geohash:string) {

    const bounds = this.bounds(geohash); // <-- the hard work
    // now just determine the centre of the cell...

    const latMin = bounds.sw.lat, lngMin = bounds.sw.lng;
    const latMax = bounds.ne.lat, lngMax = bounds.ne.lng;

    // cell centre
    let lat = (latMin + latMax)/2;
    let lng = (lngMin + lngMax)/2;

    // round to close to centre without excessive precision: ⌊2-log10(Δ°)⌋ decimal places
    lat = Number(lat.toFixed(Math.floor(2-Math.log(latMax-latMin)/Math.LN10)));
    lng = Number(lng.toFixed(Math.floor(2-Math.log(lngMax-lngMin)/Math.LN10)));

    return { lat: lat, lng: lng };
}


/**
 * Returns SW/NE latitude/longitude bounds of specified geohash.
 *
 * @param   {string} geohash - Cell that bounds are required of.
 * @returns {{sw: {lat: number, lng: number}, ne: {lat: number, lng: number}}}
 * @throws  Invalid geohash.
 */
export function bounds(geohash) {
    if (geohash.length == 0) throw new Error('Invalid geohash');

    geohash = geohash.toLowerCase();

    let evenBit = true;
    let latMin =  -90, latMax =  90;
    let lngMin = -180, lngMax = 180;

    for (let i=0; i<geohash.length; i++) {
        const chr = geohash.charAt(i);
        const idx = BASE32.indexOf(chr);
        if (idx == -1) throw new Error('Invalid geohash');

        for (let n=4; n>=0; n--) {
            const bitN = idx >> n & 1;
            if (evenBit) {
                // longitude
                const lngMid = (lngMin+lngMax) / 2;
                if (bitN == 1) {
                    lngMin = lngMid;
                } else {
                    lngMax = lngMid;
                }
            } else {
                // latitude
                const latMid = (latMin+latMax) / 2;
                if (bitN == 1) {
                    latMin = latMid;
                } else {
                    latMax = latMid;
                }
            }
            evenBit = !evenBit;
        }
    }

    const bounds = {
        sw: { lat: latMin, lng: lngMin },
        ne: { lat: latMax, lng: lngMax },
    };

    return bounds;
}


/**
 * Determines adjacent cell in given direction.
 *
 * @param   geohash - Cell to which adjacent cell is required.
 * @param   direction - Direction from geohash (N/S/E/W).
 * @returns {string} Geocode of adjacent cell.
 * @throws  Invalid geohash.
 */
export function adjacent(geohash, direction) {
    // based on github.com/davetroy/geohash-js

    geohash = geohash.toLowerCase();
    direction = direction.toLowerCase();

    if (geohash.length == 0) throw new Error('Invalid geohash');
    if ('nsew'.indexOf(direction) == -1) throw new Error('Invalid direction');

    const lastCh = geohash.slice(-1);    // last character of hash
    let parent = geohash.slice(0, -1); // hash without last character

    const type = geohash.length % 2;

    // check for edge-cases which don't share common prefix
    if (BORDER[direction][type].indexOf(lastCh) != -1 && parent != '') {
        parent = this.adjacent(parent, direction);
    }

    // append letter for direction to parent
    return parent + BASE32.charAt(NEIGHBOUR[direction][type].indexOf(lastCh));
}


/**
 * Returns all 8 adjacent cells to specified geohash.
 *
 * @param   {string} geohash - Geohash neighbours are required of.
 * @returns {{n,ne,e,se,s,sw,w,nw: string}}
 * @throws  Invalid geohash.
 */
export function neighbours(geohash) {
    return {
        'n':  this.adjacent(geohash, 'n'),
        'ne': this.adjacent(this.adjacent(geohash, 'n'), 'e'),
        'e':  this.adjacent(geohash, 'e'),
        'se': this.adjacent(this.adjacent(geohash, 's'), 'e'),
        's':  this.adjacent(geohash, 's'),
        'sw': this.adjacent(this.adjacent(geohash, 's'), 'w'),
        'w':  this.adjacent(geohash, 'w'),
        'nw': this.adjacent(this.adjacent(geohash, 'n'), 'w'),
    };
}

export function neighbourList(geohash):string[] {
  const neighs = this.neighbours(geohash);
  return [
    neighs.nw,
    neighs.n,
    neighs.ne,
    neighs.w,
    neighs.e,
    neighs.sw,
    neighs.s,
    neighs.se
  ];
}

/**
 * Calculates the number of degrees a given distance is at a given latitude.
 *
 * @param distance The distance to convert.
 * @param latitude The latitude at which to calculate.
 * @returns The number of degrees the distance corresponds to.
 */
export function metersToLongitudeDegrees(distance: number, latitude: number): number {
  const radians = degreesToRadians(latitude);
  const num = Math.cos(radians) * EARTH_EQ_RADIUS * Math.PI / 180;
  const denom = 1 / Math.sqrt(1 - E2 * Math.sin(radians) * Math.sin(radians));
  const deltaDeg = num * denom;
  if (deltaDeg < EPSILON) {
    return distance > 0 ? 360 : 0;
  }
  else {
    return Math.min(360, distance / deltaDeg);
  }
}

/**
 * Calculates the bits necessary to reach a given resolution, in meters, for the longitude at a
 * given latitude.
 *
 * @param resolution The desired resolution.
 * @param latitude The latitude used in the conversion.
 * @return The bits necessary to reach a given resolution, in meters.
 */
export function longitudeBitsForResolution(resolution: number, latitude: number): number {
  const degs = metersToLongitudeDegrees(resolution, latitude);
  return (Math.abs(degs) > 0.000001) ? Math.max(1, log2(360 / degs)) : 1;
}

/**
 * Calculates the bits necessary to reach a given resolution, in meters, for the latitude.
 *
 * @param resolution The bits necessary to reach a given resolution, in meters.
 * @returns Bits necessary to reach a given resolution, in meters, for the latitude.
 */
export function latitudeBitsForResolution(resolution: number): number {
  return Math.min(log2(EARTH_MERI_CIRCUMFERENCE / 2 / resolution), MAXIMUM_BITS_PRECISION);
}

/**
 * Wraps the longitude to [-180,180].
 *
 * @param longitude The longitude to wrap.
 * @returns longitude The resulting longitude.
 */
export function wrapLongitude(longitude: number): number {
  if (longitude <= 180 && longitude >= -180) {
    return longitude;
  }
  const adjusted = longitude + 180;
  if (adjusted > 0) {
    return (adjusted % 360) - 180;
  }
  else {
    return 180 - (-adjusted % 360);
  }
}

/**
 * Calculates the maximum number of bits of a geohash to get a bounding box that is larger than a
 * given size at the given coordinate.
 *
 * @param lat The Latitude.
 * @param lng The Longitude.
 * @param size The size of the bounding box.
 * @returns The number of bits necessary for the geohash.
 */
export function boundingBoxBits(lat:number, lng:number, size: number): number {
  const latDeltaDegrees = size / METERS_PER_DEGREE_LATITUDE;
  const latitudeNorth = Math.min(90, lat + latDeltaDegrees);
  const latitudeSouth = Math.max(-90, lat - latDeltaDegrees);
  const bitsLat = Math.floor(latitudeBitsForResolution(size)) * 2;
  const bitsLongNorth = Math.floor(longitudeBitsForResolution(size, latitudeNorth)) * 2 - 1;
  const bitsLongSouth = Math.floor(longitudeBitsForResolution(size, latitudeSouth)) * 2 - 1;
  return Math.min(bitsLat, bitsLongNorth, bitsLongSouth, MAXIMUM_BITS_PRECISION);
}

/**
 * Calculates eight points on the bounding box and the center of a given circle. At least one
 * geohash of these nine coordinates, truncated to a precision of at most radius, are guaranteed
 * to be prefixes of any geohash that lies within the circle.
 *
 * @param lat The Latitude.
 * @param lng The Longitude.
 * @param radius The radius of the circle.
 * @returns The eight bounding box points.
 */
export function boundingBoxCoordinates(lat:number, lng:number, radius:number): number[][] {
  const latDegrees = radius / METERS_PER_DEGREE_LATITUDE;
  const latitudeNorth = Math.min(90, lat + latDegrees);
  const latitudeSouth = Math.max(-90, lat - latDegrees);
  const longDegsNorth = metersToLongitudeDegrees(radius, latitudeNorth);
  const longDegsSouth = metersToLongitudeDegrees(radius, latitudeSouth);
  const longDegs = Math.max(longDegsNorth, longDegsSouth);
  return [
    [lat, lng],
    [lat, wrapLongitude(lng - longDegs)],
    [lat, wrapLongitude(lng + longDegs)],
    [latitudeNorth, lng],
    [latitudeNorth, wrapLongitude(lng - longDegs)],
    [latitudeNorth, wrapLongitude(lng + longDegs)],
    [latitudeSouth, lng],
    [latitudeSouth, wrapLongitude(lng - longDegs)],
    [latitudeSouth, wrapLongitude(lng + longDegs)]
  ];
}

export function circleOverlappingHashes(lat:number,  lng:number, radius:number): string[] {
  const precision = boundingBoxBits(lat, lng, radius);
  const boundingBox = boundingBoxCoordinates(lat, lng, radius);
  const hashes:string[] = [];
  for (let i = 0; i < boundingBox.length; i++) {
    let coords = boundingBox[i];
    hashes.push(encode(coords[0], coords[1], precision));
  }
  return hashes;
}

/**
 * Method which calculates the distance, in kilometers, between two locations,
 * via the Haversine formula. Note that this is approximate due to the fact that the
 * Earth's radius varies between 6356.752 km and 6378.137 km.
 *
 * @param location1 The [latitude, longitude] pair of the first location.
 * @param location2 The [latitude, longitude] pair of the second location.
 * @returns The distance, in kilometers, between the inputted locations.
 */
export function distance(location1: number[], location2: number[]): number {
  validateLocation(location1);
  validateLocation(location2);

  const radius = 6371; // Earth's radius in kilometers
  const latDelta = degreesToRadians(location2[0] - location1[0]);
  const lonDelta = degreesToRadians(location2[1] - location1[1]);

  const a = (Math.sin(latDelta / 2) * Math.sin(latDelta / 2)) +
    (Math.cos(degreesToRadians(location1[0])) * Math.cos(degreesToRadians(location2[0])) *
      Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2));

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}

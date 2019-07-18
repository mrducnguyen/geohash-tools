import { Component, ViewChild, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {} from 'googlemaps';
import Geohash from 'latlon-geohash';
import * as _ from 'lodash';

const DEBOUNCE_DELAY = 400;
const PRECISION_TO_ZOOM = 10/22;
const MAX_ZOOM = 20;
const MAX_FONT_SIZE = 36; //px
const MIN_FONT_SIZE = 16; //px
const MAX_PRECISION = 12;
const INITIAL_PRECISION = 7;
const INITIAL_LOCATION = {
  // St. Patrick's Cathedral
  lat: -37.810146,
  lng: 144.976332
};
const COLORS = {
  mainLine: '#a30f0f',
  mainLineOpacity: 0.8,
  mainFill: '#a30f0f',
  mainFillOpacity: 0.3,
  altLine: '#005aeb',
  altLineOpacity: 0.8,
  altFill: '#005aeb',
  altFillOpacity: 0.3,
};

@Component({
  selector: 'app-geomap',
  templateUrl: './geomap.component.html',
  styleUrls: ['./geomap.component.scss']
})
export class GeomapComponent implements OnInit {
  @ViewChild('map', {static: true}) mapElement: any;
  map: google.maps.Map;

  locationForm = new FormGroup({
    lat: new FormControl(''),
    lng: new FormControl(''),
    hash: new FormControl(''),
    precision: new FormControl(''),
    showNeighbourBound: new FormControl(false)
  })

  location = {
    lat: 0,
    lng: 0,
    hash: '',
    precision: INITIAL_PRECISION,
    showNeighbourBound: false
  }
  message = ''

  title = 'geohash-app';
  neighbours = [];
  neighboursDraws = [];

  ngOnInit() {
    this.setupLocationChange();

    const mapProperties = {
      center: new google.maps.LatLng(this.location.lat, this.location.lng),
      zoom: MAX_ZOOM,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    this.map = new google.maps.Map(this.mapElement.nativeElement, mapProperties);
    this.attachMapEvents();
    // initial location
    this.syncLocation(_.extend({}, this.location, INITIAL_LOCATION));
  }

  attachMapEvents() {
    this.map.addListener('click', data => {
      const latLng = data.latLng;
      this.syncLocation(_.extend({}, this.location, {
        lat: latLng.lat(),
        lng: latLng.lng()
      }));
    });
  }

  recenterMap() {
    this.map.setCenter(new google.maps.LatLng(this.location.lat, this.location.lng));
    let zoom = this.location.precision / PRECISION_TO_ZOOM;
    if (zoom < MAX_ZOOM) {
      this.map.setZoom(zoom);
    }
  }

  syncLocation(newLocation) {
    // change detecting
    newLocation.lat = parseFloat(newLocation.lat);
    newLocation.lng = parseFloat(newLocation.lng);

    if (this.location.showNeighbourBound !== newLocation.showNeighbourBound) {
      this.location.showNeighbourBound = newLocation.showNeighbourBound;
      this.drawNeighbourBounds();
      return;
    }

    if (_.isEqual(this.location, newLocation)) {
      // no change
      return;
    }
    let latlon = {
      lat: newLocation.lat,
      lon: newLocation.lng
    }
    if (this.location.hash !== newLocation.hash) {
      this.location.hash = newLocation.hash;
      this.location.precision = newLocation.hash.length;
      latlon = Geohash.decode(newLocation.hash);
    } else if (this.location.precision !== newLocation.precision) {
      this.location.precision = newLocation.precision;
      this.location.hash = Geohash.encode(newLocation.lat, newLocation.lng, newLocation.precision);
      latlon = Geohash.decode(this.location.hash);
    } else {
      this.location.hash = Geohash.encode(newLocation.lat, newLocation.lng, newLocation.precision);
    }
    this.location.lat = latlon.lat;
    this.location.lng = latlon.lon;
    this.setForm();
    this.setNeighbours();
    this.recenterMap();
    this.drawNeighbourBounds();
  }

  setForm() {
    this.locationForm.setValue(this.location);
  }

  setNeighbours() {
    const neighbours = Geohash.neighbours(this.location.hash);
    this.neighbours = [
      neighbours.nw,
      neighbours.n,
      neighbours.ne,
      neighbours.w,
      this.location.hash,
      neighbours.e,
      neighbours.sw,
      neighbours.s,
      neighbours.se,
    ]
  }

  drawNeighbourBounds() {
    // empty the previous recs
    for (let draw of this.neighboursDraws) {
      draw.rec.setMap(null);
      if (draw.marker !== null) {
        draw.marker.setMap(null);
      }
    }
    this.neighboursDraws = [];

    for (let hash of this.neighbours) {
      // skip drawing if showNeighbourBound is not set, and it's the main location hash
      if (!this.location.showNeighbourBound && hash !== this.location.hash) continue;

      const bounds = Geohash.bounds(hash);
      const loc = Geohash.decode(hash);
      let strokeColor = COLORS.altLine,
        strokeOpacity = COLORS.altLineOpacity,
        fillColor = COLORS.altFill,
        fillOpacity = COLORS.altFillOpacity;
      if (hash === this.location.hash) {
        strokeColor = COLORS.mainLine;
        strokeOpacity = COLORS.mainLineOpacity;
        fillColor = COLORS.mainFill;
        fillOpacity = COLORS.mainFillOpacity;
      }
      const draw = {
        rec: new google.maps.Rectangle({
          strokeColor: strokeColor,
          strokeOpacity: strokeOpacity,
          strokeWeight: 1,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          map: this.map,
          bounds: {
            north: bounds.ne.lat,
            south: bounds.sw.lat,
            east: bounds.ne.lon,
            west: bounds.sw.lon
          }
        }),
        marker: null
      };
      if (hash.length < 8) {
        let fontSize = MIN_FONT_SIZE + (MAX_FONT_SIZE - MIN_FONT_SIZE) / this.location.precision;

        draw.marker = new google.maps.Marker({
          position: new google.maps.LatLng(loc.lat, loc.lon),
          label: {
            text: hash,
            fontSize: fontSize + 'px'
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          map: this.map
        })
      }

      this.neighboursDraws.push(draw);
    }
  }

  setupLocationChange() {
    this.setForm();
    this.locationForm.valueChanges.
    pipe(
      debounceTime(DEBOUNCE_DELAY),
      distinctUntilChanged()
    ).
    subscribe(newValue => this.syncLocation(newValue));
  }
}

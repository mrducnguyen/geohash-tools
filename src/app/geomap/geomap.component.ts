import { Component, ViewChild, OnInit, Output, Input, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, ControlContainer } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {} from 'googlemaps';
import * as geoutil from '../../utils';
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
  circleLine: '#a8e000',
  circleLineOpacity: 0.8,
  circleFill: '#a8e000',
  circleFillOpacity: 0.3,
};

@Component({
  selector: 'app-geomap',
  templateUrl: './geomap.component.html',
  styleUrls: ['./geomap.component.scss']
})
export class GeomapComponent implements OnInit {
  @Input() locationSubject: Subject<google.maps.LatLng>;
  @Output() mapInit = new EventEmitter<google.maps.Map>();

  @ViewChild('map', {static: true}) mapElement: any;
  map: google.maps.Map;

  locationForm = new FormGroup({
    lat: new FormControl(''),
    lng: new FormControl(''),
    hash: new FormControl(''),
    precision: new FormControl('')
  });

  drawControlForm = new FormGroup({
    drawNeighbourBounds: new FormControl(false),
    showCircle: new FormControl(false),
    circleRadius: new FormControl({value: 4.88, disabled: true})
  })

  location = {
    lat: 0,
    lng: 0,
    hash: '',
    precision: INITIAL_PRECISION
  };

  drawControl = {
    drawNeighbourBounds: false,
    showCircle: false,
    circleRadius: 4.88
  };

  message = ''

  title = 'geohash-app';
  neighbours = [];
  neighboursDraws = [];

  ngOnInit() {
    this.setupFormEvents();

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

  ngAfterViewInit() {
    // passing the map reference to anyone who subscribe to the event
    this.mapInit.next(this.map);
    this.locationSubject.subscribe(loc => {
      this.syncLocation(_.extend({}, this.location, {
        lat: loc.lat(),
        lng: loc.lng()
      }))
    })
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

    if (_.isEqual(
      _.omit(this.location),
      _.omit(newLocation)
    )) {
      // no change
      return;
    }

    let latlng = {
      lat: newLocation.lat,
      lng: newLocation.lng
    }
    if (this.location.hash !== newLocation.hash) {
      this.location.hash = newLocation.hash;
      this.location.precision = newLocation.hash.length;
      latlng = geoutil.decode(newLocation.hash);
    } else if (this.location.precision !== newLocation.precision) {
      this.location.precision = newLocation.precision;
      this.location.hash = geoutil.encode(newLocation.lat, newLocation.lng, newLocation.precision);
      latlng = geoutil.decode(this.location.hash);
    } else {
      this.location.hash = geoutil.encode(newLocation.lat, newLocation.lng, newLocation.precision);
    }
    this.location.lat = latlng.lat;
    this.location.lng = latlng.lng;
    this.setLocationForm();
    this.setNeighbours();
    this.recenterMap();
  }

  setLocationForm() {
    this.locationForm.setValue(this.location);
  }

  setNeighbours() {
    if (this.drawControl.showCircle) {
      this.neighbours = geoutil.circleOverlappingHashes(
        this.location.lat,
        this.location.lng,
        this.drawControl.circleRadius
      );
    } else {
      this.neighbours = geoutil.neighbourList(this.location.hash);
    }
    // add the current hash in the middle
    this.neighbours.splice(4, 0, this.location.hash);
  }

  drawOnMap(control) {
    // change detecting
    // this is important to prevent endless change loop
    if (this.drawControl.showCircle !== control.showCircle) {
      // definitely a change
      this.drawControl.showCircle = control.showCircle;
    } else if (control.circleRadius !== undefined &&
      this.drawControl.circleRadius !== control.circleRadius) {
      // circle radius changed
      this.drawControl.circleRadius = control.circleRadius;
    } else if (this.drawControl.drawNeighbourBounds !== control.drawNeighbourBounds) {
      this.drawControl.drawNeighbourBounds = control.drawNeighbourBounds;
    } else {
      // nothing has changed
      return;
    }

    if (this.drawControl.showCircle) {
      this.drawControlForm.get('circleRadius').enable();
    } else {
      this.drawControlForm.get('circleRadius').disable();
    }
    this.drawNeighbourBounds();
  }

  drawNeighbourBounds() {
    // empty the previous shapes
    for (let draw of this.neighboursDraws) {
      draw.shape.setMap(null);
      if (draw.marker !== undefined) {
        draw.marker.setMap(null);
      }
    }
    this.neighboursDraws = [];

    for (let hash of this.neighbours) {
      // skip drawing if drawNeighbourBounds is not set, and it's not the main location hash
      if (!this.drawControl.drawNeighbourBounds && hash !== this.location.hash) continue;

      const bounds = geoutil.bounds(hash);
      const loc = geoutil.decode(hash);
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

      let fontSize = (MIN_FONT_SIZE + (MAX_FONT_SIZE - MIN_FONT_SIZE) / this.location.precision);
      const currentZoom = this.map.getZoom();
      if (currentZoom > MAX_ZOOM) {
        fontSize *= 1.2 * currentZoom / MAX_ZOOM;
      }

      const draw = {
        shape: new google.maps.Rectangle({
          strokeColor: strokeColor,
          strokeOpacity: strokeOpacity,
          strokeWeight: 1,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          map: this.map,
          bounds: {
            north: bounds.ne.lat,
            south: bounds.sw.lat,
            east: bounds.ne.lng,
            west: bounds.sw.lng
          }
        }),
        marker: new google.maps.Marker({
          position: new google.maps.LatLng(loc.lat, loc.lng),
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
      };
      this.neighboursDraws.push(draw);
    }
    if (this.drawControl.showCircle) {
     this.neighboursDraws.push({
       shape: new google.maps.Circle({
        strokeColor: COLORS.circleLine,
        strokeOpacity: COLORS.circleLineOpacity,
        strokeWeight: 1,
        fillColor: COLORS.circleFill,
        fillOpacity: COLORS.circleFillOpacity,
        map: this.map,
        center: {
          lat: this.location.lat,
          lng: this.location.lng
        },
        radius: this.drawControl.circleRadius * 1000
       })
     });
    }
  }

  setupFormEvents() {
    this.setLocationForm();
    this.locationForm.valueChanges.
    pipe(
      debounceTime(DEBOUNCE_DELAY),
      distinctUntilChanged()
    ).
    subscribe(newValue => this.syncLocation(newValue));

    this.drawControlForm.valueChanges.subscribe(newValue => this.drawOnMap(newValue));
  }
}

import { Component, OnInit } from '@angular/core';
import { Subject }    from 'rxjs';

@Component({
  selector: 'app-root',
  styleUrls: ['./app.component.scss'],
  template: `
    <h1>Geohash tool</h1>
    <app-places [mapSubject]="mapSubject" [locationSubject]="locationSubject"></app-places>
    <app-geomap (mapInit)="obtainMapRef($event)" [locationSubject]="locationSubject"></app-geomap>
  `
})
export class AppComponent implements OnInit {

  mapSubject = new Subject<google.maps.Map>();
  locationSubject = new Subject<google.maps.LatLng>();

  ngOnInit(): void {

  }

  obtainMapRef(map:google.maps.Map) {
    this.mapSubject.next(map);
  }
}

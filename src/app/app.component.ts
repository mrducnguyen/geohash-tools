import { Component, OnInit } from '@angular/core';
import { Subject }    from 'rxjs';

@Component({
  selector: 'app-root',
  styleUrls: ['./app.component.scss'],
  templateUrl: './app.component.html'
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

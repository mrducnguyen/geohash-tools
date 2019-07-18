import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {} from 'googlemaps';

var DEBOUNCE_DELAY = 400;

@Component({
  selector: 'app-places',
  templateUrl: './places.component.html',
  styleUrls: ['./places.component.scss']
})
export class PlacesComponent implements OnInit {
  @Input() mapSubject: Subject<google.maps.Map>;
  @Input() locationSubject: Subject<google.maps.LatLng>;
  map: google.maps.Map;
  placeService: google.maps.places.PlacesService;
  suggestions: google.maps.places.PlaceResult[];
  placeLoading = false;
  placeSet = false;

  placeForm = new FormGroup({
    placeSearch: new FormControl('')
  });

  constructor(private ref: ChangeDetectorRef) { }

  ngOnInit() {
    this.mapSubject.subscribe(map => {
      this.map = map;
      this.placeService = new google.maps.places.PlacesService(map);
    });

    this.placeForm.valueChanges.
    pipe(
      debounceTime(DEBOUNCE_DELAY),
      distinctUntilChanged()
    ).
    subscribe(data => this.showSuggestions(data));
  }

  showSuggestions(data) {
    if (this.placeService == null) return;
    if (data.placeSearch.length < 3) return;

    if (this.placeSet) {
      // flag for setting place
      this.placeSet = false;
      return;
    }

    this.placeLoading = true;
    this.placeService.textSearch({
      query: data.placeSearch
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        this.suggestions = results;
        console.log('got results', this.suggestions);
      }
      this.placeLoading = false;
      this.ref.detectChanges();
    });
  }

  selectSuggestion(place:google.maps.places.PlaceResult) {
    this.suggestions = [];
    this.locationSubject.next(place.geometry.location);
    this.placeSet = true;
    this.placeForm.setValue({
      placeSearch: place.name + ' - ' + place.formatted_address
    });
    this.ref.detectChanges();
  }
}

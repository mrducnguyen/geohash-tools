import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  styleUrls: ['./app.component.scss'],
  template: `
    <app-places></app-places>
    <app-geomap></app-geomap>
  `
})
export class AppComponent implements OnInit {
  ngOnInit(): void {

  }
}

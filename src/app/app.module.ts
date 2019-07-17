import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule }    from '@angular/forms';

import { AppComponent } from './app.component';
import { PlacesComponent } from './places/places.component';
import { GeomapComponent } from './geomap/geomap.component';

@NgModule({
  declarations: [
    AppComponent,
    PlacesComponent,
    GeomapComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

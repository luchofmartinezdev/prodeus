import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FooterComponent } from "../../shared/components/footer/footer";

import { ButtonComponent } from "../../shared/components/button/button";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FooterComponent, ButtonComponent],
  templateUrl: './home.html'
})
export class HomeComponent { }
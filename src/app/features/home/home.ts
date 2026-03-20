import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FooterComponent } from "../../shared/components/footer/footer";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FooterComponent],
  templateUrl: './home.html'
})
export class HomeComponent { }
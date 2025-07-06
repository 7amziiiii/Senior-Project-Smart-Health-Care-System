import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'or-front';
  
  constructor(private router: Router) {}
  
  ngOnInit() {
    // Subscribe to router events to debug navigation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        console.log('DEBUG - Navigation Event:', {
          url: event.url,
          urlAfterRedirects: event.urlAfterRedirects,
          id: event.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
}

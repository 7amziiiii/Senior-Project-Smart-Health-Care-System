import { Pipe, PipeTransform } from '@angular/core';
import { Surgery } from '../services/surgery-data.service';

@Pipe({
  name: 'surgeryFilter',
  standalone: true
})
export class SurgeryFilterPipe implements PipeTransform {
  transform(surgeries: Surgery[], searchTerm: string = ''): Surgery[] {
    if (!surgeries || !searchTerm.trim()) {
      return surgeries;
    }
    
    const term = searchTerm.toLowerCase().trim();
    return surgeries.filter(surgery => 
      surgery.name.toLowerCase().includes(term) ||
      surgery.roomNumber?.toString().includes(term) ||
      (surgery.scheduledTime && new Date(surgery.scheduledTime).toLocaleString().toLowerCase().includes(term))
    );
  }
}

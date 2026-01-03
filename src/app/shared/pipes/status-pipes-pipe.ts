import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusPipes',
})
export class StatusPipesPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}

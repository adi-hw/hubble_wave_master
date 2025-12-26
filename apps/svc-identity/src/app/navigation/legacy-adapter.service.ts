import { Injectable } from '@nestjs/common';

@Injectable()
export class LegacyAdapterService {
  transform(): any[] {
    return [];
  }
}

import { Module } from '@nestjs/common';
import { ReadingModule } from '../reading/reading.module.js';
import { LibraryStatusRepository } from './library-status.repository.js';
import { LibraryStatusService } from './library-status.service.js';

// Separate from LibraryModule so the catalog can import it without a cycle (SPEC 20):
// library imports catalog, catalog imports only this.
@Module({
  imports: [ReadingModule],
  providers: [LibraryStatusService, LibraryStatusRepository],
  exports: [LibraryStatusService],
})
export class LibraryStatusModule {}

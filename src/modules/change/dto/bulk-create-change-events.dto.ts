import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateChangeEventDto } from './create-change-event.dto.js';

export class BulkCreateChangeEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChangeEventDto)
  events!: CreateChangeEventDto[];
}

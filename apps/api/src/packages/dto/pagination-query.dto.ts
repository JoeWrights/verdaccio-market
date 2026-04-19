import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public pageSize = 10;
}

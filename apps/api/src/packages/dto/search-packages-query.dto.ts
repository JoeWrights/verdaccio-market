import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";

export class SearchPackagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  public query?: string;
}

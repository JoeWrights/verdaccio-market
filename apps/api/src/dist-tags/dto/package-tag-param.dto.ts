import { IsNotEmpty, IsString } from "class-validator";

export class PackageTagParamDto {
  @IsString()
  @IsNotEmpty()
  public packageName!: string;

  @IsString()
  @IsNotEmpty()
  public tagName!: string;
}

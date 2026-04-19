import { IsNotEmpty, IsString } from "class-validator";

export class PackageVersionParamDto {
  @IsString()
  @IsNotEmpty()
  public packageName!: string;

  @IsString()
  @IsNotEmpty()
  public version!: string;
}

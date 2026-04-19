import { IsNotEmpty, IsString } from "class-validator";

export class PackageNameParamDto {
  @IsString()
  @IsNotEmpty()
  public packageName!: string;
}

import { IsNotEmpty, IsString } from "class-validator";

export class DeprecateVersionBodyDto {
  @IsString()
  @IsNotEmpty()
  public version!: string;

  @IsString()
  @IsNotEmpty()
  public message!: string;
}

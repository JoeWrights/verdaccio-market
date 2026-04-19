import { IsNotEmpty, IsString } from "class-validator";

export class UpsertTagBodyDto {
  @IsString()
  @IsNotEmpty()
  public version!: string;
}

import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  public token!: string;

  @IsOptional()
  @IsString()
  public username?: string;
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface PatientJwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  type: string;
  iat: number;
  exp: number;
}

export interface ValidatedPatient {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: PatientJwtPayload): Promise<ValidatedPatient> {
    if (payload.type !== 'access' || payload.role !== 'patient') {
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}

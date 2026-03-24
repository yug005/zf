import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID', 'placeholder'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET', 'placeholder'),
      callbackURL: `${configService.get<string>('BACKEND_URL', 'http://localhost:3000')}/api/v1/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { username, emails, photos, id } = profile;
    const user = {
      githubId: id.toString(),
      email: emails[0]?.value || null,
      name: username,
      avatarUrl: photos?.[0]?.value || null,
      accessToken,
    };
    done(null, user);
  }
}

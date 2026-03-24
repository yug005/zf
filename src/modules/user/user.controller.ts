import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/v1/users/me
   * Returns the authenticated user's own profile.
   * Users cannot query other users' profiles.
   */
  @Get('me')
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.userService.findOne(userId);
  }
}

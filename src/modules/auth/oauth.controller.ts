import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { extractChatRequestMeta } from '../../common/chat-request-meta';
import { SITE_CONFIG } from '../../common/tokens';
import { SiteConfig } from '../../config/site-config';
import { ChatThreadsService } from '../chat-threads/chat-threads.service';
import { ClaimOAuthThreadsDto } from './dto/claim-oauth.dto';
import { RequireRoles } from './roles.decorator';
import { AuthenticatedRequest, RolesGuard } from './roles.guard';

@Controller('api/auth/oauth')
export class OAuthController {
  constructor(
    @Inject(SITE_CONFIG) private readonly siteConfig: SiteConfig,
    private readonly chatThreads: ChatThreadsService,
  ) {}

  /** Public: where frontends should send users to start OAuth. */
  @Get('providers')
  providers() {
    const authBase = this.siteConfig.domains.auth.replace(/\/+$/, '');
    const providers = this.siteConfig.oauth?.providers?.length
      ? this.siteConfig.oauth.providers
      : ['github'];

    return {
      authBase,
      claimThreads: this.siteConfig.oauth?.claimThreads ?? true,
      providers: providers.map((id) => ({
        id,
        name: id === 'github' ? 'GitHub' : id === 'google' ? 'Google' : id,
        loginUrl: `${authBase}/login?provider=${id}`,
      })),
    };
  }

  /**
   * Authenticated: claim anonymous chat threads for the current user.
   * Pass clientId in body or x-client-id header.
   */
  @Post('claim')
  @UseGuards(RolesGuard)
  @RequireRoles('viewer')
  async claim(
    @Body() dto: ClaimOAuthThreadsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const meta = extractChatRequestMeta(request);
    const clientId = dto.clientId || meta.clientId;
    return this.chatThreads.claimAnonymousThreads(clientId || '', request.auth!);
  }
}

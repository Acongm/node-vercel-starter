import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { extractChatRequestMeta } from '../../common/chat-request-meta';
import { ChatThreadsService } from '../chat-threads/chat-threads.service';
import { ClaimOAuthThreadsDto } from './dto/claim-oauth.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { OAuthProviderName, OAuthService } from './oauth.service';
import { RequireRoles } from './roles.decorator';
import { AuthenticatedRequest, RolesGuard } from './roles.guard';

@Controller('api/auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly chatThreads: ChatThreadsService,
  ) {}

  /** Public: where frontends should send users to start OAuth. */
  @Get('providers')
  providers() {
    return this.oauth.listProviders();
  }

  /** Redirect browser to GitHub / Google authorize URL. */
  @Get(':provider/start')
  start(
    @Param('provider') provider: string,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ) {
    const url = this.oauth.buildAuthorizeUrl(
      this.parseProvider(provider),
      next,
    );
    return res.redirect(url);
  }

  /** OAuth provider callback → redirect to frontend with access_token. */
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const session = await this.oauth.handleCallback({
      provider: this.parseProvider(provider),
      code,
      state,
    });
    return res.redirect(
      this.oauth.buildFrontendRedirect(session.next, session.accessToken),
    );
  }

  /** SPA / mobile: exchange authorization code for API access token. */
  @Post(':provider/exchange')
  exchange(
    @Param('provider') provider: string,
    @Body() dto: OAuthExchangeDto,
  ) {
    return this.oauth.exchangeCode({
      provider: this.parseProvider(provider),
      code: dto.code,
      redirectUri: dto.redirectUri,
    });
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
    return this.chatThreads.claimAnonymousThreads(
      clientId || '',
      request.auth!,
    );
  }

  private parseProvider(value: string): OAuthProviderName {
    if (value === 'github' || value === 'google') return value;
    throw new BadRequestException(`Unsupported OAuth provider: ${value}`);
  }
}

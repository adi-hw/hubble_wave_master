import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThemeDefinition, UserThemePreference } from '@hubblewave/instance-db';
import { CreateThemeDto, UpdatePreferenceDto, UpdateThemeDto } from './theme.dto';

@Injectable()
export class ThemeService {
  constructor(
    @InjectRepository(ThemeDefinition)
    private readonly themeRepo: Repository<ThemeDefinition>,
    @InjectRepository(UserThemePreference)
    private readonly prefRepo: Repository<UserThemePreference>,
  ) {}

  async list() {
    const themes = await this.themeRepo.find({
      where: { isActive: true },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
    return { data: themes };
  }

  async findOne(id: string) {
    const theme = await this.themeRepo.findOne({ where: { id } });
    if (!theme) {
      throw new NotFoundException(`Theme with id ${id} not found`);
    }
    return theme;
  }

  async findByCode(code: string) {
    const theme = await this.themeRepo.findOne({ where: { code } });
    if (!theme) {
      throw new NotFoundException(`Theme with code ${code} not found`);
    }
    return theme;
  }

  async create(dto: CreateThemeDto, userId?: string) {
    this.validate(dto);

    // Check if code/slug already exists
    const existing = await this.themeRepo.findOne({ where: { code: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Theme with code ${dto.slug} already exists`);
    }

    const theme = this.themeRepo.create({
      code: dto.slug,
      name: dto.name,
      description: dto.description,
      config: dto.config as any,
      themeType: (dto.themeType === 'custom' || dto.themeType === 'system') ? dto.themeType : 'instance',
      contrastLevel: dto.contrastLevel || 'normal',
      colorScheme: dto.colorScheme || 'dark',
      isDefault: dto.isDefault || false,
      createdById: userId,
    });

    // If this theme is set as default, unset other defaults
    if (theme.isDefault) {
      await this.themeRepo.update({ isDefault: true }, { isDefault: false });
    }

    return this.themeRepo.save(theme);
  }

  async update(id: string, dto: UpdateThemeDto) {
    const theme = await this.findOne(id);

    if (!theme.isDeletable && dto.slug && dto.slug !== theme.code) {
      throw new BadRequestException('Cannot change code of system theme');
    }

    if (dto.name !== undefined) theme.name = dto.name;
    if (dto.slug !== undefined) theme.code = dto.slug;
    if (dto.description !== undefined) theme.description = dto.description;
    if (dto.config !== undefined) theme.config = dto.config as any;
    if (dto.isActive !== undefined) theme.isActive = dto.isActive;

    // Handle default flag
    if (dto.isDefault !== undefined) {
      if (dto.isDefault && !theme.isDefault) {
        await this.themeRepo.update({ isDefault: true }, { isDefault: false });
      }
      theme.isDefault = dto.isDefault;
    }

    return this.themeRepo.save(theme);
  }

  async remove(id: string) {
    const theme = await this.findOne(id);

    if (!theme.isDeletable) {
      throw new BadRequestException('Cannot delete system theme');
    }

    if (theme.isDefault) {
      throw new BadRequestException('Cannot delete default theme');
    }

    await this.themeRepo.remove(theme);
    return { id, deleted: true };
  }

  async getPreference(userId: string) {
    let pref = await this.prefRepo.findOne({
      where: { userId },
      relations: ['theme'],
    });

    // Create default preference if none exists
    if (!pref) {
      const defaultTheme = await this.themeRepo.findOne({ where: { isDefault: true } });
      pref = this.prefRepo.create({
        userId,
        themeId: defaultTheme?.id || null,
        colorScheme: 'auto',
        autoDarkMode: true,
        customOverrides: {},
        preferenceSource: 'default',
      });
      pref = await this.prefRepo.save(pref);
      pref.theme = defaultTheme || undefined;
    }

    return {
      userId: pref.userId,
      themeId: pref.themeId,
      autoDarkMode: pref.autoDarkMode,
      colorScheme: pref.colorScheme,
      customOverrides: pref.customOverrides,
      theme: pref.theme,
    };
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    if (dto.colorScheme && !['dark', 'light', 'auto'].includes(dto.colorScheme)) {
      throw new BadRequestException('Invalid color scheme');
    }

    // Validate theme exists if provided
    if (dto.themeId) {
      const theme = await this.themeRepo.findOne({ where: { id: dto.themeId } });
      if (!theme) {
        throw new BadRequestException(`Theme with id ${dto.themeId} not found`);
      }
    }

    let pref = await this.prefRepo.findOne({ where: { userId } });

    if (!pref) {
      // Create new preference
      pref = this.prefRepo.create({
        userId,
        themeId: dto.themeId ?? null,
        colorScheme: dto.colorScheme || 'auto',
        autoDarkMode: dto.autoDarkMode ?? true,
        customOverrides: dto.customOverrides || {},
        preferenceSource: 'manual',
      });
    } else {
      // Update existing preference
      if (dto.themeId !== undefined) pref.themeId = dto.themeId;
      if (dto.colorScheme !== undefined) pref.colorScheme = dto.colorScheme;
      if (dto.autoDarkMode !== undefined) pref.autoDarkMode = dto.autoDarkMode;
      if (dto.customOverrides !== undefined) pref.customOverrides = dto.customOverrides;
      pref.preferenceSource = 'manual';
    }

    pref = await this.prefRepo.save(pref);

    // Load theme relation for response
    if (pref.themeId) {
      pref.theme = await this.themeRepo.findOne({ where: { id: pref.themeId } }) || undefined;
    }

    return {
      userId: pref.userId,
      themeId: pref.themeId,
      autoDarkMode: pref.autoDarkMode,
      colorScheme: pref.colorScheme,
      customOverrides: pref.customOverrides,
      theme: pref.theme,
    };
  }

  async getDefaultTheme() {
    return this.themeRepo.findOne({ where: { isDefault: true } });
  }

  private validate(dto: CreateThemeDto) {
    if (dto.colorScheme && !['dark', 'light'].includes(dto.colorScheme)) {
      throw new BadRequestException('Invalid color scheme for theme definition');
    }
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Theme name is required');
    }
    if (!dto.slug || dto.slug.trim().length === 0) {
      throw new BadRequestException('Theme slug is required');
    }
  }
}

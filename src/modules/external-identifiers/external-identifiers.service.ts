import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { dataResponse } from '../../common/dto/api-response';
import { PrismaService } from '../../database/prisma.service';
import type { CreateExternalIdentifierDto, UpdateExternalIdentifierDto } from './dto/external-identifier.dto';

export type IdentifierEntityType = 'Athlete' | 'Horse' | 'Club' | 'CompetitionEvent';

@Injectable()
export class ExternalIdentifiersService {
  constructor(private readonly prisma:PrismaService) {}

  async list(entityType:IdentifierEntityType,entityId:string){
    await this.assertEntity(entityType,entityId);
    return dataResponse(await this.prisma.externalIdentifier.findMany({
      where:{entityType,entityId,archivedAt:null},orderBy:[{isPrimary:'desc'},{createdAt:'desc'},{id:'asc'}],take:100,
      select:{id:true,identifierType:true,namespace:true,value:true,normalizationVersion:true,verificationStatus:true,isPrimary:true,validFrom:true,validTo:true,sourceReference:true,verifiedAt:true,createdAt:true,updatedAt:true},
    }));
  }

  async create(entityType:IdentifierEntityType,entityId:string,dto:CreateExternalIdentifierDto){
    await this.assertEntity(entityType,entityId);
    const normalizedValue=this.normalize(dto.value);
    return dataResponse(await this.prisma.externalIdentifier.create({data:{...dto,entityType,entityId,normalizedValue}}));
  }

  async update(entityType:IdentifierEntityType,entityId:string,identifierId:string,dto:UpdateExternalIdentifierDto){
    await this.assertOwned(entityType,entityId,identifierId);
    const data:Prisma.ExternalIdentifierUpdateInput={...dto};
    if(dto.value!==undefined) data.normalizedValue=this.normalize(dto.value);
    return dataResponse(await this.prisma.externalIdentifier.update({where:{id:identifierId},data}));
  }

  private normalize(value:string):string{return value.normalize('NFKC').trim();}

  private async assertOwned(entityType:IdentifierEntityType,entityId:string,id:string):Promise<void>{
    const found=await this.prisma.externalIdentifier.findFirst({where:{id,entityType,entityId},select:{id:true}});
    if(!found) throw new NotFoundException({message:'External identifier not found',code:'NOT_FOUND'});
  }

  private async assertEntity(type:IdentifierEntityType,id:string):Promise<void>{
    let found:{id:string}|null;
    switch(type){
      case 'Athlete': found=await this.prisma.athlete.findUnique({where:{id},select:{id:true}}); break;
      case 'Horse': found=await this.prisma.horse.findUnique({where:{id},select:{id:true}}); break;
      case 'Club': found=await this.prisma.club.findUnique({where:{id},select:{id:true}}); break;
      case 'CompetitionEvent': found=await this.prisma.competitionEvent.findUnique({where:{id},select:{id:true}}); break;
    }
    if(!found) throw new NotFoundException({message:`${type} not found`,code:'NOT_FOUND'});
  }
}

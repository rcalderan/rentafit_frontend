
type UUID = string;

export interface ICustomer {
  id?: UUID;
  legacyId?: string;
  name: string;
  document: string;
  isAuthenticated: boolean;
  /** Opcional para clientes cadastrados no balcão; obrigatório só no cadastro online. */
  email?: string | null;
  notes: string;
  complement: string;  
  number: string;
  phones: string[];
  address: IAddress;
}

export interface IAddress {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
{
    "id": "d8d98e8b-2788-4917-95a9-53ef056951be",
    "name": "Ma5465767887ira",
    "document": "10987654321",
    "email": "maria.oliveira@example.com",
    "isAuthenticated": true,
    "notes": "Cliente novo",
    "address": {
        "zipCode": "23456-789",
        "street": "Avenida Brasil",
        "neighborhood": "Jardim América",
        "city": "Rio de Janeiro",
        "state": "RJ"
    },
    "number": "456",
    "complement": "Casa 12",
    "phones": [
        "21987654321",
        "2133334444"
    ]
}
 */

    // "id": 1,
    // "name": "JOÃO DA SILVA",
    // "document": "123.456.789-00",
    // "documentType": "CPF",
    // "birthDate": "1990-05-15",
    // "sex": true,
    // "authentication": true,
    // "phones": [
    //     "(11) 98888-8888",
    //     "(11) 3333-3333"
    // ],
    // "details": "CLIENTE PREFERENCIAL",
    // "email": "joao@email.com",
    // "address": {
    //     "cep": "01234-567",
    //     "street": "RUA DAS FLORES",
    //     "number": "123",
    //     "complement": null,
    //     "neighborhood": "CENTRO",
    //     "city": "SÃO PAULO",
    //     "state": "SP"
    // }